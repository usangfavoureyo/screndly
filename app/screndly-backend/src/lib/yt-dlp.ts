import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const LOCAL_BINARY_PATH = path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const LOCAL_COOKIE_FILE_PATH = path.join(process.cwd(), 'temp', 'yt-dlp-cookies.txt');
const DEFAULT_BINARY_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 90 * 1000;

type YtDlpArrayValue = Array<string | number>;
export type YtDlpOptionValue = string | number | boolean | YtDlpArrayValue | undefined | null;
export type YtDlpOptions = Record<string, YtDlpOptionValue>;

function ensureLocalCookieFile(contents: string): string {
    fs.mkdirSync(path.dirname(LOCAL_COOKIE_FILE_PATH), { recursive: true });

    if (!fs.existsSync(LOCAL_COOKIE_FILE_PATH) || fs.readFileSync(LOCAL_COOKIE_FILE_PATH, 'utf8') !== contents) {
        fs.writeFileSync(LOCAL_COOKIE_FILE_PATH, contents, { encoding: 'utf8', mode: 0o600 });
    }

    return LOCAL_COOKIE_FILE_PATH;
}

function resolveCookieFilePath(): string | null {
    const configuredPath = process.env.YT_DLP_COOKIE_FILE_PATH?.trim();
    if (configuredPath) {
        return configuredPath;
    }

    const rawContents = process.env.YT_DLP_COOKIE_FILE;
    if (rawContents && rawContents.trim().length > 0) {
        return ensureLocalCookieFile(rawContents.replace(/\r\n/g, '\n'));
    }

    const base64Contents = process.env.YT_DLP_COOKIE_FILE_BASE64?.trim();
    if (base64Contents) {
        return ensureLocalCookieFile(Buffer.from(base64Contents, 'base64').toString('utf8'));
    }

    return null;
}

function resolveBinaryPath(): string {
    const configuredPath = process.env.YT_DLP_BINARY_PATH?.trim();
    if (configuredPath) {
        return configuredPath;
    }

    if (fs.existsSync(LOCAL_BINARY_PATH)) {
        return LOCAL_BINARY_PATH;
    }

    return DEFAULT_BINARY_NAME;
}

export function getYtDlpAuthOptions(): YtDlpOptions {
    const options: YtDlpOptions = {};
    const cookieFilePath = resolveCookieFilePath();
    if (cookieFilePath) {
        options.cookies = cookieFilePath;
    }

    const proxy = process.env.YT_DLP_PROXY_URL?.trim();
    if (proxy) {
        options.proxy = proxy;
    }

    const userAgent = process.env.YT_DLP_USER_AGENT?.trim();
    if (userAgent) {
        options.userAgent = userAgent;
    }

    return options;
}

export function hasYtDlpAuthConfiguration(): boolean {
    const options = getYtDlpAuthOptions();
    return Boolean(options.cookies || options.proxy);
}

export function describeYtDlpAuthConfiguration(): string {
    const options = getYtDlpAuthOptions();
    const enabledModes: string[] = [];

    if (options.cookies) {
        enabledModes.push('cookies');
    }

    if (options.proxy) {
        enabledModes.push('proxy');
    }

    if (options.userAgent) {
        enabledModes.push('user-agent');
    }

    return enabledModes.length > 0 ? enabledModes.join(', ') : 'none';
}

function toCliFlag(optionName: string): string {
    return `--${optionName.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
}

function appendOptionArgs(args: string[], optionName: string, optionValue: YtDlpOptionValue) {
    if (optionValue === undefined || optionValue === null || optionValue === false) {
        return;
    }

    const flag = toCliFlag(optionName);
    if (Array.isArray(optionValue)) {
        for (const value of optionValue) {
            if (value === undefined || value === null) {
                continue;
            }

            args.push(flag, String(value));
        }

        return;
    }

    if (optionValue === true) {
        args.push(flag);
        return;
    }

    args.push(flag, String(optionValue));
}

function buildArgs(url: string, options: YtDlpOptions): string[] {
    const args: string[] = [];

    for (const [optionName, optionValue] of Object.entries(options)) {
        appendOptionArgs(args, optionName, optionValue);
    }

    args.push(url);
    return args;
}

function resolveTimeoutMs(): number {
    const configured = Number.parseInt(String(process.env.YT_DLP_TIMEOUT_MS || ''), 10);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

export default async function ytDlp(url: string, options: YtDlpOptions = {}): Promise<any> {
    const args = buildArgs(url, options);

    try {
        const { stdout, stderr } = await execFileAsync(resolveBinaryPath(), args, {
            maxBuffer: MAX_BUFFER_BYTES,
            timeout: resolveTimeoutMs(),
            windowsHide: true,
        });

        if (options.dumpSingleJson) {
            return JSON.parse(stdout);
        }

        return { stdout, stderr };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'yt-dlp command failed';
        const stdout = typeof (error as { stdout?: unknown })?.stdout === 'string'
            ? (error as { stdout: string }).stdout
            : '';
        const stderr = typeof (error as { stderr?: unknown })?.stderr === 'string'
            ? (error as { stderr: string }).stderr
            : '';
        const combined = [stderr, stdout, message].filter((value) => value && value.trim().length > 0).join('\n');
        const wrappedError = new Error(combined || message);
        (wrappedError as Error & { stdout?: string; stderr?: string }).stdout = stdout;
        (wrappedError as Error & { stdout?: string; stderr?: string }).stderr = stderr;
        throw wrappedError;
    }
}

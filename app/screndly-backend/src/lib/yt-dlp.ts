import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const LOCAL_BINARY_PATH = path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const DEFAULT_BINARY_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

type YtDlpArrayValue = Array<string | number>;
type YtDlpOptionValue = string | number | boolean | YtDlpArrayValue | undefined | null;
type YtDlpOptions = Record<string, YtDlpOptionValue>;

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

export default async function ytDlp(url: string, options: YtDlpOptions = {}): Promise<any> {
    const args = buildArgs(url, options);

    try {
        const { stdout, stderr } = await execFileAsync(resolveBinaryPath(), args, {
            maxBuffer: MAX_BUFFER_BYTES,
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

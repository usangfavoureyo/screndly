process.env.NODE_ENV = process.env.NODE_ENV || 'test';
export {};

async function main() {
    const { default: app } = await import('../index');

    const port = Number(process.env.VERIFY_PORT || process.env.PORT || 3000);
    const host = process.env.VERIFY_HOST || '127.0.0.1';

    app.listen(port, host, () => {
        console.log(`[verify-server] Listening on http://${host}:${port}`);
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

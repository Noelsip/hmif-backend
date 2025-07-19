module.exports = {
    apps: [
        {
        name: "hmif-backend",
        script: "app.js",
        instances: "max",
        exec_mode: "cluster",
        env: {
            NODE_ENV: "production",
            PORT: 3000,
        },
        errors_file: "./logs/err.log",
        out_file: "./logs/out.log",
        log_file: "./logs/combined.log",
        time: true,
    }],
};

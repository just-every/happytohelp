const within = (promise, timeoutMs, message, onTimeout = null) => new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
        if (settled) return;

        settled = true;
        if (onTimeout) onTimeout();
        reject(new Error(message));
    }, timeoutMs);

    Promise.resolve(promise).then(value => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);
        resolve(value);
    }, error => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);
        reject(error);
    });
});

export { within };

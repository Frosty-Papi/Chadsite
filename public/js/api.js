window.api = async function (url, body = {}, options = {}) {
    const csrf =
    document.querySelector('meta[name="csrf-token"]')?.content ||
    document.querySelector('input[name="_csrf"]')?.value;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(csrf ? { "CSRF-Token": csrf } : {})
            },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));

        // ❌ ERROR HANDLING
        if (!res.ok) {
            const msg = data.error || options.error || "Request failed";
            if (!options.silent) toast.error(msg);
            throw new Error(msg);
        }

        // ✅ SUCCESS HANDLING
        if (options.success) {
            toast.success(options.success);
        }

        return data;

    } catch (err) {
        if (!options.silent) {
            toast.error(err.message || "Network error");
        }
        throw err;
    }
};

const originalFetch = window.fetch;

window.fetch = async (...args) => {
    try {
        const res = await originalFetch(...args);

        // Try parsing JSON safely
        let data = {};
        try {
            data = await res.clone().json();
        } catch {}

        if (!res.ok) {
            const msg = data.error || "Request failed";
            toast.error(msg);
        } else if (data.success) {
            // Only show success if backend sends it
            toast.success(data.success);
        }

        return res;

    } catch (err) {
        toast.error("Network error");
        throw err;
    }
};

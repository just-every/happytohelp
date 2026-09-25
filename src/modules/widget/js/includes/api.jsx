function request(url, params, method = 'GET') {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (params) {
        if (method === 'GET') {
            url += '?' + objectToQueryString(params);
        } else {
            if (params instanceof FormData) {
                delete options.headers['Content-Type'];
                options.body = params;
            } else {
                options.body = JSON.stringify(params);
            }
        }
    }

    return fetch(url, options).then(res => {
        return !res.ok
            ? res.json().then(e => Promise.reject(e))
            : res.json();
    });
}

function objectToQueryString(obj) {
    return Object.keys(obj).map(key => key + '=' + obj[key]).join('&');
}

function get(url, params) {
    return request(url, params);
}

function create(url, params) {
    return request(url, params, 'POST');
}

function update(url, params) {
    return request(url, params, 'PUT');
}

function remove(url, params) {
    return request(url, params, 'DELETE');
}

const Api = {
    get,
    create,
    update,
    remove
}
export default Api;

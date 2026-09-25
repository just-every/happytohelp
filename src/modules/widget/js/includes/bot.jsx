const BOT_USERAGENT_KEYWORDS = [
    'bot', 'crawl', 'slurp', 'spider',
    'whatsapp', 'telegrambot', 'slackbot',
    'viber', 'discordbot', 'skypeuripreview',
    'pingdom', 'googlebot', 'bingbot',
    'yandexbot', 'baiduspider', 'duckduckbot',
    'facebot', 'linkedinbot', 'mj12bot',
    'semrushbot', 'ahrefsbot', 'siteaudit',
    'uptimerobot', 'monit', 'datadog',
    'newrelic', 'synthetics'
];

const userAgent = navigator.userAgent.toLowerCase();
export const isBot = BOT_USERAGENT_KEYWORDS.some(keyword => userAgent.includes(keyword))

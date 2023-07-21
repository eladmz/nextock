const fs = require('fs/promises');

const axios = require('axios');
const cheerio = require('cheerio');

const { TELEGRAM_BOT_API_KEY, TELEGRAM_CHANNEL_ID, ITEMS_CSV_FILE_PATH } = process.env;
const sentItems = new Set();

const readItems = async () => {
    const items = [];

    const data = await fs.readFile(ITEMS_CSV_FILE_PATH, 'utf-8');
    const lines = data.split('\n');
    for (const line of lines) {
        const parts = line.split(',');
        if (parts[0] && parts[1]) {
            items.push({ url: parts[0], value: parts[1] });
        }
    }

    return items;
};

const extractItemIdFromUrl = (url) => {
    const fullId = url.substring(url.lastIndexOf('#') + 1);
    return `${fullId.substring(0, 3)}-${fullId.substring(3)}`;
};

const checkIfItemInStock = async (url, value) => {
    let inStock = false;
    let size = 'N/A';
    let price = 'N/A';
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const itemId = extractItemIdFromUrl(url);
    $(`#Size-${itemId}`)
        .find('option')
        .each((i, option) => {
            const attributes = $(option).attr();
            const dataValue = attributes['value'];
            const dataSize = attributes['data-size'];
            const dataStockStatus = attributes['data-stockstatus'];
            const dataPrice = attributes['data-price'];
            if (dataValue === value && dataStockStatus === 'InStock') {
                inStock = true;
                size = dataSize;
                price = dataPrice;
            }
        });

    return { inStock, size, price };
};

const sendToTelegram = async (url, size, price) => {
    console.log(`${url} in size ${size} was found!`);
    const requestBody = {
        chat_id: TELEGRAM_CHANNEL_ID,
        parse_mode: 'HTML',
        text: `<b>IN STOCK!</b>

Size: <b>${size}</b>
Price: <b>₪${price}</b>

${url}

<i>© Frrr Bots Inc. All rights reserved.</i>`
    };
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_API_KEY}/sendMessage`, requestBody);
};

const main = async () => {
    try {
        const items = await readItems();
        for (const item of items) {
            const { url, value } = item;
            const hash = `${url}__${value}`;
            if (sentItems.has(hash)) {
                console.log(`${url} with value ${value} was already found! skipping...`);
                continue;
            }
            const { inStock, size, price } = await checkIfItemInStock(url, value);
            if (inStock) {
                await sendToTelegram(url, size, price);
                sentItems.add(hash);
            }
            console.log(JSON.stringify({ url, value, inStock, size, price }));
        }
    } catch (err) {
        console.log('Failed to run ', err.toString());
    } finally {
        setTimeout(main, 15 * 60 * 1000);
    }
};

main();

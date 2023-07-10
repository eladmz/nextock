const fs = require('fs/promises');

const axios = require('axios');
const cheerio = require('cheerio');

const { TELEGRAM_BOT_API_KEY, TELEGRAM_CHANNEL_ID, ITEMS_CSV_FILE_PATH } = process.env;
const sentItems = new Set();

const readItems = async () => {
    const data = await fs.readFile(ITEMS_CSV_FILE_PATH, 'utf-8');
    const lines = data.split('\n');

    const items = [];
    for (const line of lines) {
        const parts = line.split(',');
        if (parts[0] && parts[1]) {
            items.push({ url: parts[0], size: parts[1] });
        }
    }
    return items;
};

const extractItemIdFromUrl = (url) => {
    const fullId = url.substring(url.lastIndexOf('#') + 1);
    return `${fullId.substring(0, 3)}-${fullId.substring(3)}`;
};

const checkIfItemInStock = async (url, size) => {
    let status = false;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const itemId = extractItemIdFromUrl(url);
    $(`#Size-${itemId}`)
        .find('option')
        .each((i, option) => {
            const attributes = $(option).attr();
            const stockSize = attributes['data-size'];
            const stockStatus = attributes['data-stockstatus'];
            if (stockSize === size && stockStatus === 'InStock') {
                status = true;
            }
        });

    return status;
};

const sendToTelegram = async (url, size) => {
    console.log(`${url} in size ${size} was found!`);
    const requestBody = {
        chat_id: TELEGRAM_CHANNEL_ID,
        parse_mode: 'HTML',
        text: `<b>Size: '${size}' is in Stock!</b>
    
${url}`
    };
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_API_KEY}/sendMessage`, requestBody);
};

const main = async () => {
    try {
        const items = await readItems();
        for (const item of items) {
            const { url, size } = item;
            const hash = `${url}__${size}`;
            if (sentItems.has(hash)) {
                console.log(`${url} in size ${size} was already found! skipping...`);
                continue;
            }
            const status = await checkIfItemInStock(url, size);
            if (status) {
                await sendToTelegram(url, size);
                sentItems.add(hash);
            }
        }
    } catch (err) {
        console.log('Failed to run ', err.toString());
    } finally {
        setTimeout(main, 15 * 60 * 1000);
    }
};

main();

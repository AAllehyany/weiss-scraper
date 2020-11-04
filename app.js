const Axios = require('axios');
const cheerio = require('cheerio');
const Fs = require('fs');
const Path = require('path');
const BASE_URL = "https://en.ws-tcg.com/cardlist/list/";
const FIRST_CARD = ".?cardno=TSK/S70-E001";

const getHTML = async (cardNo) => {
    try {
        const data = await Axios.get(BASE_URL+cardNo);
        return data.data;
    } catch(e) {
        console.log('ERROR', e);
    }
}


const scrapeData = async (card) => {
    const result = [];
    let currentCard = card;
    while(true) {
        const page = await getHTML(currentCard);
        const $ = await cheerio.load(page);

        console.log(`[EXTRACTING] Card No.: ${currentCard}... `);
        const cardInfo = await extractCard(page, $);
        result.push(cardInfo);
        console.log(`[DONE EXTRACTING] Card No.: ${currentCard}... `);

        const next = $('.neighbor a:contains("next")').first();
        const nextCard = $(next).attr('href');
        if(nextCard === undefined) break;
        console.log(`[FINISHED] GOING TO CARD Card No.: ${nextCard}... `);
        currentCard = nextCard;
    }
    return result;
}

async function downloadImage (url, filename) {  
    const path = Path.resolve(__dirname, 'images', `${filename}`)
    const writer = Fs.createWriteStream(path)
  
    const response = await Axios({
      url,
      method: 'GET',
      responseType: 'stream'
    })
  
    response.data.pipe(writer)
  
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
} 


const getTHContains = ($, value) => {
    return $(`th:contains("${value}")`).first();
}


const mapCardtype = (card_type) => {
    switch(card_type.toLowerCase()) {
        case 'character': return 1;
        case 'event': return 2;
        case 'climax': return 3;
    }
};

const mapColor = (color) => {
    switch(color.toLowerCase()) {
        case 'yellow': return 1;
        case 'green': return 2;
        case 'red': return 3;
        case 'blue': return 4;
    }

    return -1;
}

const toNumber = (val) => {
    const lvl = parseInt(val);
    return isNaN(lvl) ? -1 : lvl;
}



const extractCard = async (page, $) => {
    const card = {};


    const cardName = $(getTHContains($, 'Card Name')).next().text().trim().split('\n')[0];
    const set_code = $(getTHContains($, 'Card No')).next().text().trim();
    const rarity = $(getTHContains($, 'Rarity')).next().text().trim();
    const card_type = $(getTHContains($, 'Card Type')).next().text().trim();
    const soul = $(getTHContains($, 'Soul')).next().find('img');
    const triggers = $(getTHContains($, 'Trigger')).next().find('img');
    const level = $(getTHContains($, 'Level')).next().text().trim();
    const color = $(getTHContains($, "Color")).next().find('img').attr('src').split('/');
    const power = $(getTHContains($, "Power")).next().text().trim();
    const text = $(getTHContains($, "Text")).next().text().trim();
    const traits = $(getTHContains($, "Attribute")).next().text().trim();
    const img = $('.graphic img').attr('src');

    const imgParts = img.split('/')
    
    
    card["name"] = cardName;
    card["set_code"] = set_code;
    card["rarity"] = rarity;
    card["soul"] = soul.length || 0;
    card["card_type"] = mapCardtype(card_type);
    card["level"] = toNumber(level);
    card["color"] = mapColor(color[color.length - 1].split('.')[0]);
    card["power"] = toNumber(power);
    card["text"] = text;
    card["triggers"] = triggers.map((idx, el) => {
        const parts = $(el).attr('src').split('/');
        const trigger = parts[parts.length - 1].split('.')[0];
        return trigger;
    }).get();

    card["traits"] = traits;
    card.game = 'WS';

    await downloadImage(BASE_URL+img, imgParts[imgParts.length - 1]);
    return card;
}


const main = async() => {
    try {
        const args = process.argv.slice(2);
        const data = await scrapeData(FIRST_CARD);
        const filename = args[0] || 'data';
        await Fs.promises.writeFile(`${filename}.json`, JSON.stringify(data, null, 2));
    }catch(e) {
        console.log(e)
    }
}

main();
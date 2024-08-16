// ==UserScript==
// @name        Hamster all keygenV6
// @version     1.8
// @homepageURL https://github.com/georg95/hamster-bike-keygen/blob/main/README.md
// @author      RezaDorosti
// @namespace   Violentmonkey Scripts
// @match       *://georg95.github.io/*
// @grant       GM_xmlhttpRequest
// @grant       GM_getResourceURL
// @grant       GM_getValue
// @grant       GM_setValue
// @run-at      document-end
// @resource    BACKGROUND https://georg95.github.io/hamster-bike-keygen/keygen_bg.jpg
// @noframes
// ==/UserScript==

const CONFIG = {
    BIKE: {
        appToken: 'd28721be-fd2d-4b45-869e-9f253b554e50',
        promoId: '43e35910-c168-4634-ad4f-52fd764a843f'
    },
    CLONE: {
        appToken: '74ee0b5b-775e-4bee-974f-63e7f4d5bacb',
        promoId: 'fe693b26-b342-4159-8808-15e3ff7f8767'
    },
    CUBE: {
        appToken: 'd1690a07-3780-4068-810f-9b5bbf2931b2',
        promoId: 'b4170868-cef0-424f-8eb9-be0622e8e8e3'
    },
    TRAIN: {
        appToken: '82647f43-3f87-402d-88dd-09a90025313f',
        promoId: 'c4480ac7-e178-4973-8061-9ed5b2e17954'
    },
    MERGE: {
            appToken: '8d1cc2ad-e097-4b86-90ef-7a27e19fb833',
            promoId: 'dc128d28-c45b-411c-98ff-ac7726fbaea4'
    }
};

let APP_TOKEN = CONFIG.BIKE.appToken;
let PROMO_ID = CONFIG.BIKE.promoId;
const DEBUG_MODE = false;
const EVENTS_DELAY = DEBUG_MODE ? 350 : 20000;

const PARAMS = new URL(location.href).searchParams;
const USER_ID = PARAMS.get('id');
const USER = PARAMS.get('user');
const HASH = PARAMS.get('hash');

start();

function getKeyHistory() {
    const keyList = document.querySelector('ul'); // Get the key list element
    const keys = Array.from(keyList.children).map(item => item.textContent); // Get text content of each list item
    return keys.join('\n'); // Return keys formatted for clipboard
}

function initProgress(keyText) {
    const delays = 6;
    const progressPerDelay = 20;
    let totalProgress = progressPerDelay * delays;
    let emojiFlip = false;
    keyText.innerText = `${emojiFlip ? '⏳' : '⌛'}0%`;
    let curProgress = 0;
    async function progressDelay(unexpected) {
        if (unexpected) {
            totalProgress += progressPerDelay;
        }
        const delay = EVENTS_DELAY * delayRandom();
        const delayInterval = delay / progressPerDelay;
        for (let i = 0; i < progressPerDelay; i++) {
            keyText.innerText = `${emojiFlip ? '⏳' : '⌛'}${Math.round(curProgress / totalProgress * 100)}%`;
            curProgress++;
            emojiFlip = !emojiFlip;
            await sleep(delayInterval);
        }
    }

    return progressDelay;
}

async function commitKey(key) {
    const keyData = btoa(JSON.stringify({ id: USER_ID, user: USER, hash: HASH, key }));
    // Log the key to history (not using addKeyToHistory anymore)
    const keyList = document.querySelector('ul');
    const listItem = document.createElement('li');
    listItem.textContent = key;
    keyList.appendChild(listItem);

    if (DEBUG_MODE) {
        console.log('[bg] commit key', key);
        return await vmFetch('http://localhost:7000/key?v=' + keyData, { method: 'POST' });
    }
    return await vmFetch('http://localhost:7000/key?v=' + keyData, { method: 'POST' });
}

async function start() {
    const { startBtn, keyText, pointsText, copyBtn, nextBtn, buttons, keyList, clearListBtn } = createLayout();

    let farmedKeys = 0;
    pointsText.innerText = `@${USER}: +💎0`;
    const keyTextOriginalSize = keyText.style.fontSize;

    startBtn.onclick = () => {
        buttons.innerHTML = '';
        runAgain(4); // Call runAgain to generate keys 4 times
    };

    async function runAgain(times) {
        for (let i = 0; i < times; i++) {
            await keygen().catch(onKeygenFail); // Generate a key
        }
    }

    nextBtn.onclick = () => {
        runAgain(1);
        buttons.removeChild(nextBtn);
    };

    async function keygen() {
        keyText.innerText = '⏳⏳⏳';
        const token = await login(generateClientId());
        const progressDelay = initProgress(keyText);
        console.log('login, token:', token);
        for (let i = 0; i < 7; i++) {
            await progressDelay(i >= 5);
            const hasCode = await emulateProgess(token);
            console.log('emulate progress...', hasCode);
            if (hasCode) {
                break;
            }
        }
        await progressDelay();
        const key = await generateKey(token);
        console.log('key:', key);
        if (USER_ID) {
            const { status, points } = await commitKey(key);
            if (status !== 'ok') {
                keyText.innerText = `⛔ ${status}`;
                buttons.appendChild(startBtn);
                return;
            }
            console.log('status', status, 'points', points);
            farmedKeys++;
            pointsText.innerText = `@${USER}: +💎${points * farmedKeys}`;
            keyText.innerText = `⏳ ${EVENTS_DELAY / 1000}s`;
            await sleep(EVENTS_DELAY * delayRandom());
            return; // Do not call runAgain() here to allow for multiple starts
        }
        keyText.innerText = key;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(key);
            const copyBtnDefaultText = copyBtn.innerText;
            copyBtn.innerText = '✅';
            setTimeout(() => copyBtn.innerText = copyBtnDefaultText, 1500);
        };

        buttons.innerHTML = '';
        buttons.appendChild(copyBtn);
        buttons.appendChild(nextBtn);

        // Update the list view with the new key
        updateKeyList(key);
    }

    async function onKeygenFail(e) {
        keyText.style.fontSize = '12px';
        console.log(e);
        keyText.innerText = e.toString() + '\nRestart in 20s...';
        buttons.innerHTML = '';
        await countdownRestart(20); // Start countdown for restart
        runAgain(4); // Automatically restart after countdown
    }
}

// Function to handle countdown before restart
async function countdownRestart(seconds) {
    const countdownText = document.createElement('div');
    countdownText.style.position = 'fixed';
    countdownText.style.top = '70px';
    countdownText.style.left = '10px';
    countdownText.style.zIndex = '1000';
    countdownText.style.color = 'white';
    countdownText.style.fontSize = '20px';
    countdownText.innerText = `Restarting in ${seconds} seconds...`;
    document.body.appendChild(countdownText);

    for (let i = seconds; i > 0; i--) {
        countdownText.innerText = `Restarting in ${i} seconds...`;
        await sleep(1000);
    }

    document.body.removeChild(countdownText); // Remove countdown text after completion
}

function createLayout() {
    document.body.innerHTML = '';

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.fontFamily = 'monospace';
    container.style.alignItems = 'center';
    container.style.boxSizing = 'border-box';
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.right = '0px';
    container.style.margin = '0';
    container.style.padding = '0';
    const layoutWidth = Math.min(window.innerWidth, 768);
    const layoutHeight = Math.min(layoutWidth, window.innerHeight);
    container.style.width = `${layoutWidth}px`;
    container.style.height = `${layoutHeight}px`;
    container.style.background = 'url(' + GM_getResourceURL('BACKGROUND') + ')';
    container.style.backgroundPosition = 'center';
    container.style.backgroundSize = 'cover';

    const overlay = document.createElement('div');
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.width = '100%';
    overlay.style.margin = '0';
    overlay.style.padding = '0 0 30px 0';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.background = 'rgba(0, 0, 0, 0.6)';
    overlay.style.backgroundSize = 'cover';

    const promoLink = document.createElement('a');
    promoLink.style.color = 'lime';
    promoLink.style.textShadow = 'black 0 0 3px';
    promoLink.style.position = 'absolute';
    promoLink.style.left = '10px';
    promoLink.style.top = '10px';
    promoLink.href = location.href;
    promoLink.innerText = '';
    promoLink.target = '_blank';

    const keyText = document.createElement('div');
    keyText.style.margin = '20px 0';
    keyText.style.padding = '0';
    keyText.style.background = 'none';
    keyText.style.color = 'white';
    keyText.style.fontSize = `${Math.min(Math.floor(layoutWidth / 16))}px`;

    const pointsText = document.createElement('div');
    pointsText.style.margin = '20px 0';
    pointsText.style.padding = '0';
    pointsText.style.background = 'none';
    pointsText.style.color = 'white';
    pointsText.style.fontSize = `${Math.min(Math.floor(layoutWidth / 16))}px`;

    // Radio buttons for APP_TOKEN and PROMO_ID selection
    const radioContainer = document.createElement('div');
    radioContainer.style.marginBottom = '20px';
    radioContainer.style.background = 'none';
    radioContainer.style.color = 'white';

    Object.keys(CONFIG).forEach(key => {
        const radioLabel = document.createElement('label');
        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = 'appToken';
        radioInput.value = key;
        radioInput.checked = key === 'BIKE'; // Default selection

        radioInput.addEventListener('change', () => {
            APP_TOKEN = CONFIG[key].appToken;
            PROMO_ID = CONFIG[key].promoId;
        });

        radioLabel.appendChild(radioInput);
        radioLabel.appendChild(document.createTextNode(key));
        radioContainer.appendChild(radioLabel);
        radioContainer.appendChild(document.createElement('br'));
    });

    overlay.appendChild(radioContainer);

    const buttons = document.createElement('div');
    buttons.style.background = 'none';
    buttons.style.display = 'flex';
    buttons.style.margin = '0';
    buttons.style.padding = '0';

    const copyBtn = document.createElement('button');
    copyBtn.style.width = '50px';
    copyBtn.style.height = '50px';
    copyBtn.style.fontSize = '25px';
    copyBtn.style.marginRight = '10px'; // Adjusted margin for spacing
    copyBtn.innerText = '📋';

    const nextBtn = document.createElement('button');
    nextBtn.style.width = '50px';
    nextBtn.style.height = '50px';
    nextBtn.style.fontSize = '25px';
    nextBtn.innerText = '↻';

    const startBtn = document.createElement('button');
    startBtn.style.width = '100px';
    startBtn.style.height = '100px';
    startBtn.style.fontSize = '50px';
    startBtn.innerText = '▶️';

    // Add Copy History Button
    const historyCopyBtn = document.createElement('button');
    historyCopyBtn.style.position = 'fixed';
    historyCopyBtn.style.top = '10px';
    historyCopyBtn.style.left = '10px';
    historyCopyBtn.style.zIndex = '1000'; // Ensure it's on top
    historyCopyBtn.style.padding = '10px';
    historyCopyBtn.style.fontSize = '16px';
    historyCopyBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    historyCopyBtn.style.color = 'white';
    historyCopyBtn.style.border = 'none';
    historyCopyBtn.style.cursor = 'pointer';
    historyCopyBtn.innerText = 'Copy History';
    document.body.appendChild(historyCopyBtn); // Add button to the body

    const clearListBtn = document.createElement('button');
    clearListBtn.style.position = 'fixed';
    clearListBtn.style.top = '70px'; // Position below the Copy History button
    clearListBtn.style.left = '10px';
    clearListBtn.style.zIndex = '1000'; // Ensure it's on top
    clearListBtn.style.padding = '10px';
    clearListBtn.style.fontSize = '16px';
    clearListBtn.style.backgroundColor = 'rgba(255, 0, 0, 0.7)'; // Red background
    clearListBtn.style.color = 'white';
    clearListBtn.style.border = 'none';
    clearListBtn.style.cursor = 'pointer';
    clearListBtn.innerText = '🗑️'; // Icon for clear list
    document.body.appendChild(clearListBtn); // Add button to the body

    // Create a list to display generated keys
    const keyList = document.createElement('ul');
    keyList.style.position = 'fixed';
    keyList.style.top = '120px'; // Position below the Clear List button
    keyList.style.left = '10px';
    keyList.style.zIndex = '1000'; // Ensure it's on top
    keyList.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Match button background
    keyList.style.color = 'white'; // Match button text color
    keyList.style.padding = '10px';
    keyList.style.borderRadius = '5px';
    document.body.appendChild(keyList); // Add the list to the body

    // Add event listener for history copy button
    historyCopyBtn.onclick = () => {
        const historyString = getKeyHistory(); // Get formatted keys for clipboard
        if (!historyString) {
            alert('No keys generated yet.');
            return;
        }
        navigator.clipboard.writeText(historyString).then(() => {
            alert('History copied to clipboard!');
        });
    };

    // Add event listener for clear list button
    clearListBtn.onclick = () => {
        keyList.innerHTML = ''; // Clear the list items
        alert('Key history cleared!');
    };

    buttons.appendChild(copyBtn);
    buttons.appendChild(nextBtn);
    buttons.appendChild(startBtn);
    overlay.appendChild(keyText);
    if (USER_ID) {
        overlay.appendChild(pointsText);
    }
    overlay.appendChild(buttons);
    container.appendChild(overlay);
    container.appendChild(promoLink);
    document.body.appendChild(container);

    return { keyText, pointsText, startBtn, copyBtn, nextBtn, clearListBtn, buttons, keyList };
}

// Function to update the key list with the new key
function updateKeyList(key) {
    const keyList = document.querySelector('ul');
    const listItem = document.createElement('li');
    listItem.textContent = key;
    keyList.appendChild(listItem);
}

function delayRandom() {
    return (Math.random() / 3 + 1);
}

async function login(clientId) {
    if (!clientId) { throw new Error('no client id'); }
    if (DEBUG_MODE) {
        return 'd28721be-fd2d-4b45-869e-9f253b554e50:deviceid:1722266117413-8779883520062908680:8B5BnSuEV2W:' + Date.now();
    }
    const { clientToken } = await vmFetch('https://api.gamepromo.io/promo/login-client', {
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'Host': 'api.gamepromo.io'
        },
        method: 'POST',
        body: {
            appToken: APP_TOKEN,
            clientId: clientId,
            clientOrigin: 'deviceid'
        }
    });
    return clientToken;
}

const attempts = {};
async function emulateProgess(clientToken) {
    if (!clientToken) { throw new Error('no access token'); }
    if (DEBUG_MODE) {
        attempts[clientToken] = (attempts[clientToken] || 0) + 1;
        return attempts[clientToken] >= 5;
    }
    const { hasCode } = await vmFetch('https://api.gamepromo.io/promo/register-event', {
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'Host': 'api.gamepromo.io',
            'Authorization': `Bearer ${clientToken}`
        },
        method: 'POST',
        body: {
            promoId: PROMO_ID,
            eventId: crypto.randomUUID(),
            eventOrigin: 'undefined'
        }
    });
    return hasCode;
}

async function generateKey(clientToken) {
    if (DEBUG_MODE) {
        if (attempts[clientToken] >= 5) {
            return 'BIKE-3YD-5ZA6-3VJA-Y77';
        } else {
            return '';
        }
    }
    const { promoCode } = await vmFetch('https://api.gamepromo.io/promo/create-code', {
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'Host': 'api.gamepromo.io',
            'Authorization': `Bearer ${clientToken}`
        },
        method: 'POST',
        body: {
            promoId: PROMO_ID
        }
    });
    return promoCode;
}

async function vmFetch(url, options) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: options.method,
            url: url,
            headers: options.headers,
            data: typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
            responseType: 'json',
            onload: response => {
                try {
                    console.log(response.responseText);
                    resolve(JSON.parse(response.responseText));
                } catch (e) { reject(response.responseText); }
            },
            onerror: response => {
                reject(response.responseText || 'No internet?');
            },
        });
    });
}

async function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

function generateClientId() {
    const timestamp = Date.now();
    const randomNumbers = Array.from({ length: 19 }, () => Math.floor(Math.random() * 10)).join('');
    return `${timestamp}-${randomNumbers}`;
}

// Configuration
const CURRENCIES = [
    { id: 'usd', name: 'USD', symbol: '$USD', coingeckoId: 'usd' },
    { id: 'jpy', name: 'JPY', symbol: '$JPY', coingeckoId: 'jpy' },
    { id: 'btc', name: 'Bitcoin', symbol: '$BTC', coingeckoId: 'bitcoin' },
    { id: 'sol', name: 'Solana', symbol: '$SOL', coingeckoId: 'solana' },
    { id: 'ggt', name: 'Go Game Token', symbol: '$GGT', coingeckoId: 'go-game-token' },
    { id: 'gmt', name: 'Green Metaverse Token', symbol: '$GMT', coingeckoId: 'stepn' },
    { id: 'gst', name: 'Green Satoshi Token', symbol: '$GST', coingeckoId: 'green-satoshi-token' }
];

// API configuration
const API_URL = 'https://api.coingecko.com/api/v3/simple/price';
const UPDATE_INTERVAL = 60000; // 1 minute in milliseconds
const DEBOUNCE_DELAY = 500; // 500ms for debouncing input changes

// State variables
let priceData = {};
let lastUpdateTime = null;
let updateTimer = null;
let isLoading = false;

// DOM elements
const cryptoTableBody = document.querySelector('#crypto-table tbody');
const lastUpdateTimeElement = document.getElementById('last-update-time');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessageElement = document.getElementById('error-message');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeTable();
    fetchPrices();
    
    // Set up periodic updates
    updateTimer = setInterval(fetchPrices, UPDATE_INTERVAL);
});

// Initialize the table with rows for each currency
function initializeTable() {
    CURRENCIES.forEach(currency => {
        const row = document.createElement('tr');
        row.id = `row-${currency.id}`;
        
        // 通貨ごとに適切な画像形式を選択
        let logoSrc = '';
        let onerrorSrc = '';
        
        if (currency.id === 'usd' || currency.id === 'jpy') {
            logoSrc = `${currency.id}.png`;
            onerrorSrc = `'${currency.id}.webp'`;
        } else if (currency.id === 'ggt') {
            logoSrc = `${currency.id}.jpg`;
            onerrorSrc = `'${currency.id}.png'`;
        } else {
            logoSrc = `${currency.id}.webp`;
            onerrorSrc = `'${currency.id}.png'`;
        }
        
        row.innerHTML = `
            <td data-label="通貨/シンボル">
                <div class="currency-info">
                    <img src="${logoSrc}" alt="${currency.name} logo" class="currency-logo" onerror="this.onerror=null;this.src=${onerrorSrc}" loading="lazy">
                    <div>
                        <span class="currency-name">${currency.name}</span>
                        <span class="currency-symbol">${currency.symbol}</span>
                    </div>
                </div>
            </td>
            <td data-label="現在価格">
                <div class="price-info">
                    <span class="price-usd" id="price-usd-${currency.id}">-</span>
                    <span class="price-jpy" id="price-jpy-${currency.id}">-</span>
                </div>
            </td>
            <td data-label="数量">
                <input type="number" 
                       id="amount-${currency.id}" 
                       placeholder="0.00" 
                       step="any" 
                       min="0"
                       data-currency-id="${currency.id}">
            </td>
        `;
        
        cryptoTableBody.appendChild(row);
        
        // Add event listener to the input field
        const inputField = document.getElementById(`amount-${currency.id}`);
        inputField.addEventListener('input', debounce(handleAmountInput, DEBOUNCE_DELAY));
    });
}

// Fetch prices from the CoinGecko API
async function fetchPrices() {
    showLoading(true);
    showError('');
    
    try {
        // Prepare the API request parameters
        const ids = CURRENCIES.map(currency => currency.coingeckoId).join(',');
        const vs_currencies = 'usd,jpy';
        
        const response = await fetch(`${API_URL}?ids=${ids}&vs_currencies=${vs_currencies}`);
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Process the API response
        processPriceData(data);
        
        // Update the UI
        updatePriceDisplay();
        updateLastUpdateTime();
        
        // If there's an active input, recalculate values
        const activeInput = document.querySelector('input[type="number"]:focus');
        if (activeInput) {
            handleAmountInput({ target: activeInput });
        }
    } catch (error) {
        console.error('Error fetching prices:', error);
        showError(`価格データの取得に失敗しました: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Process the price data from the API response
function processPriceData(data) {
    // Initialize priceData with default values
    priceData = {
        usd: { usd: 1, jpy: 0 },
        jpy: { usd: 0, jpy: 1 },
        btc: { usd: 0, jpy: 0 },
        sol: { usd: 0, jpy: 0 },
        ggt: { usd: 0, jpy: 0 },
        gmt: { usd: 0, jpy: 0 },
        gst: { usd: 0, jpy: 0 }
    };
    
    // Map the API response to our priceData structure
    CURRENCIES.forEach(currency => {
        const apiData = data[currency.coingeckoId];
        if (apiData) {
            priceData[currency.id].usd = apiData.usd || 0;
            priceData[currency.id].jpy = apiData.jpy || 0;
        }
    });
    
    // Special case for JPY/USD conversion
    if (data.usd && data.usd.jpy) {
        priceData.jpy.usd = 1 / data.usd.jpy;
    }
}

// Update the price display in the table
function updatePriceDisplay() {
    CURRENCIES.forEach(currency => {
        const usdPriceElement = document.getElementById(`price-usd-${currency.id}`);
        const jpyPriceElement = document.getElementById(`price-jpy-${currency.id}`);
        
        if (usdPriceElement && priceData[currency.id]) {
            usdPriceElement.textContent = formatCurrency(priceData[currency.id].usd, 'USD');
        }
        
        if (jpyPriceElement && priceData[currency.id]) {
            jpyPriceElement.textContent = formatCurrency(priceData[currency.id].jpy, 'JPY');
        }
    });
}

// Handle input in amount fields
function handleAmountInput(event) {
    const inputElement = event.target;
    const currencyId = inputElement.dataset.currencyId;
    const amount = parseFloat(inputElement.value);
    
    if (isNaN(amount) || amount < 0) {
        return;
    }
    
    // Calculate the total value in USD
    const totalValueUsd = amount * priceData[currencyId].usd;
    
    // Update all other input fields with the equivalent amounts
    CURRENCIES.forEach(currency => {
        if (currency.id !== currencyId) {
            const equivalentAmount = priceData[currency.id].usd > 0 
                ? totalValueUsd / priceData[currency.id].usd 
                : 0;
            
            const otherInputElement = document.getElementById(`amount-${currency.id}`);
            if (otherInputElement) {
                otherInputElement.value = formatAmount(equivalentAmount, currency.id);
            }
        }
    });
}

// Update the last update time display
function updateLastUpdateTime() {
    lastUpdateTime = new Date();
    lastUpdateTimeElement.textContent = formatDateTime(lastUpdateTime);
}

// Show or hide the loading indicator
function showLoading(show) {
    isLoading = show;
    loadingIndicator.classList.toggle('hidden', !show);
}

// Show or hide error messages
function showError(message) {
    if (message) {
        errorMessageElement.textContent = message;
        errorMessageElement.classList.remove('hidden');
    } else {
        errorMessageElement.classList.add('hidden');
    }
}

// Format currency values for display
function formatCurrency(value, currency) {
    if (value === undefined || value === null) {
        return '-';
    }
    
    const options = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: currency === 'JPY' ? 2 : 6
    };
    
    return new Intl.NumberFormat('ja-JP', options).format(value);
}

// Format amount values for input fields
function formatAmount(value, currencyId) {
    if (value === undefined || value === null || isNaN(value)) {
        return '';
    }
    
    // Determine appropriate decimal places based on currency
    let decimalPlaces = 8;
    
    if (currencyId === 'usd' || currencyId === 'jpy') {
        decimalPlaces = 2;
    } else if (currencyId === 'btc') {
        decimalPlaces = 8;
    } else if (currencyId === 'sol' || currencyId === 'ggt' || currencyId === 'gmt') {
        decimalPlaces = 6;
    } else if (currencyId === 'gst') {
        decimalPlaces = 4;
    }
    
    return value.toFixed(decimalPlaces);
}

// Format date and time for display
function formatDateTime(date) {
    if (!date) {
        return '-';
    }
    
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo'
    };
    
    return new Intl.DateTimeFormat('ja-JP', options).format(date) + ' JST';
}

// Debounce function to limit the rate of function calls
function debounce(func, delay) {
    let timeout;
    
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

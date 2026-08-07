let allPokemonData = [];
let pokemonList = [];
let currentIndex = 0;
let favorites = [];
let currentUser = localStorage.getItem('pokeswipe_active_user');

async function init() {
    await fetchAllPokemonNames();
    if (currentUser) {
        loadUserData();
        showMain();
    }
}

async function fetchAllPokemonNames() {
    try {
        // Limit auf 151 für die erste Generation oder höher nach Belieben
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=2000');
        const data = await response.json();
        allPokemonData = data.results;
    } catch (e) { 
        console.error("Fehler beim Laden der API-Daten", e); 
    }
}

async function getNames(id, englishName) {
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        const germanEntry = data.names.find(n => n.language.name === "de");
        return { de: germanEntry ? germanEntry.name : englishName, en: englishName };
    } catch (e) {
        return { de: englishName, en: englishName };
    }
}

function login() {
    const input = document.getElementById('username').value.trim().toLowerCase();
    if (input) {
        currentUser = input;
        localStorage.setItem('pokeswipe_active_user', currentUser);
        loadUserData();
        showMain();
    }
}

function loadUserData() {
    const savedIndex = localStorage.getItem(`ps_${currentUser}_idx`);
    const savedFavs = localStorage.getItem(`ps_${currentUser}_favs`);
    const savedOrder = localStorage.getItem(`ps_${currentUser}_order`);

    currentIndex = savedIndex ? parseInt(savedIndex) : 0;
    favorites = savedFavs ? JSON.parse(savedFavs) : [];

    if (savedOrder) {
        const orderNames = JSON.parse(savedOrder);
        pokemonList = orderNames.map(name => allPokemonData.find(p => p.name === name)).filter(Boolean);
    } else {
        // Zufällige Reihenfolge beim ersten Mal erstellen
        pokemonList = [...allPokemonData].sort(() => Math.random() - 0.5);
        const orderNames = pokemonList.map(p => p.name);
        localStorage.setItem(`ps_${currentUser}_order`, JSON.stringify(orderNames));
    }
}

function saveUserData() {
    if (!currentUser) return;
    localStorage.setItem(`ps_${currentUser}_idx`, currentIndex);
    localStorage.setItem(`ps_${currentUser}_favs`, JSON.stringify(favorites));
}

function logout() {
    localStorage.removeItem('pokeswipe_active_user');
    location.reload();
}

function showMain() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('library-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('user-display').innerText = currentUser;
    renderCard();
}

async function renderCard() {
    const container = document.getElementById('card-stack');
    container.innerHTML = '<div class="card"><h2 style="margin-top:150px">Suche...</h2></div>';
    
    if (currentIndex >= pokemonList.length) {
        container.innerHTML = `
            <div class='card'>
                <h2 style='margin-top:150px'>🏆 Geschafft!</h2>
                <p>Du hast alle Pokémon gesichtet.</p>
            </div>`;
        updateCounter();
        return;
    }

    const poke = pokemonList[currentIndex];
    const id = poke.url.split('/').filter(Boolean).pop();
    const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
    const names = await getNames(id, poke.name);

    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <img src="${sprite}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png'">
        <div class="name-box">
            <div class="name-en">🇺🇸 ${names.en.replace(/-/g, ' ')}</div>
            <div class="name-de">🇩🇪 ${names.de}</div>
        </div>
    `;
    container.appendChild(card);
    updateCounter();
}

// SWIPE LOGIK
function swipeLeft() { 
    currentIndex++; 
    saveUserData(); 
    renderCard(); 
}

async function swipeRight() {
    const current = pokemonList[currentIndex];
    if (current && !favorites.find(f => f.name === current.name)) {
        const id = current.url.split('/').filter(Boolean).pop();
        const names = await getNames(id, current.name);
        favorites.push({ ...current, germanName: names.de });
    }
    currentIndex++;
    saveUserData();
    renderCard();
}

// NEU: Rückgängig machen
function undoSwipe() {
    if (currentIndex > 0) {
        currentIndex--;
        const lastPoke = pokemonList[currentIndex];
        // Falls es geliked wurde, aus Favoriten entfernen
        favorites = favorites.filter(f => f.name !== lastPoke.name);
        saveUserData();
        renderCard();
    }
}

// BIBLIOTHEK LOGIK
function showLibrary() {
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('library-screen').classList.remove('hidden');
    
    const dlBtn = document.getElementById('download-btn');
    // Button nur zeigen, wenn Stapel leer
    if (currentIndex >= pokemonList.length && favorites.length > 0) {
        dlBtn.classList.remove('hidden');
    } else {
        dlBtn.classList.add('hidden');
    }

    renderLibraryGrid();
}

function renderLibraryGrid() {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';
    
    favorites.forEach(p => {
        const id = p.url.split('/').filter(Boolean).pop();
        grid.innerHTML += `
            <div class="grid-item">
                <button class="remove-btn" onclick="removeFromLibrary('${p.name}')">✕</button>
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png">
                <div class="lib-en">🇺🇸 ${p.name.replace(/-/g, ' ')}</div>
                <div class="lib-de">🇩🇪 ${p.germanName || p.name}</div>
            </div>`;
    });
}

// NEU: Aus Bibliothek löschen
function removeFromLibrary(pokemonName) {
    favorites = favorites.filter(f => f.name !== pokemonName);
    saveUserData();
    renderLibraryGrid();
    
    // Download Button Zustand prüfen
    const dlBtn = document.getElementById('download-btn');
    if (favorites.length === 0) dlBtn.classList.add('hidden');
}

// DOWNLOAD LOGIK
function downloadLibrary() {
    const textHeader = `Trainer: ${currentUser}\nMeine Favoriten-Liste:\n--------------------------\n\n`;
    
    const pokemonText = favorites.map(p => {
        const nameForWiki = p.germanName || p.name;
        const wikiLink = `https://www.pokewiki.de/${nameForWiki.charAt(0).toUpperCase() + nameForWiki.slice(1)}`;
        return `Name: ${nameForWiki} (EN: ${p.name})\nLink: ${wikiLink}\n`;
    }).join('\n');

    const blob = new Blob([textHeader + pokemonText], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pokeswipe_${currentUser}_liste.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// HELFER
function resetApp() { if (confirm("Fortschritt komplett löschen?")) { localStorage.clear(); location.reload(); } }
function updateCounter() { document.getElementById('counter').innerText = `${currentIndex} / ${pokemonList.length}`; }
function showMainScreen() { showMain(); } // Alias für Zurück-Button

init();
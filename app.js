class MusicPlayer {
    constructor() {
        this.tracks = [];
        this.playlists = {};
        this.currentTrackIndex = -1;
        this.currentPlaylist = 'all';
        this.audio = new Audio();
        this.isPlaying = false;
        this.playlistToDelete = null;
        this.db = null;
        
        // Темы
        this.themes = [
            {
                name: 'Классическая',
                bg: '#f5f5f5',
                primary: '#2196F3',
                primaryHover: '#1976D2',
                text: '#333333',
                textLight: '#999999',
                cardBg: '#ffffff',
                cardBorder: '#e0e0e0',
                sidebarBg: '#fafafa',
                playerBarBg: '#fafafa',
                hoverBg: '#f8f8f8',
                controlBtnBg: '#f0f0f0',
                controlBtnHover: '#e0e0e0',
                accentLight: '#e3f2fd',
                shadow: 'rgba(0, 0, 0, 0.1)'
            },
            {
                name: 'Тёплая',
                bg: '#fdf8ed',
                primary: '#dc2626',
                primaryHover: '#b91c1c',
                text: '#3b2f2a',
                textLight: '#8b7355',
                cardBg: '#fffaf0',
                cardBorder: '#e8d5b0',
                sidebarBg: '#fef9f0',
                playerBarBg: '#fef9f0',
                hoverBg: '#fff5e6',
                controlBtnBg: '#f5e6d3',
                controlBtnHover: '#e8d5b0',
                accentLight: '#fef2f2',
                shadow: 'rgba(139, 115, 85, 0.15)'
            },
            {
                name: 'Лесная',
                bg: '#eef4ed',
                primary: '#2d6a4f',
                primaryHover: '#1b4332',
                text: '#1b4332',
                textLight: '#40916c',
                cardBg: '#ffffff',
                cardBorder: '#b7d7c5',
                sidebarBg: '#f7faf8',
                playerBarBg: '#f7faf8',
                hoverBg: '#f0f7f2',
                controlBtnBg: '#e6f0e8',
                controlBtnHover: '#c8e0ce',
                accentLight: '#e8f5e9',
                shadow: 'rgba(27, 67, 50, 0.1)'
            },
            {
                name: 'Закатная',
                bg: '#fff5f0',
                primary: '#f97316',
                primaryHover: '#ea580c',
                text: '#4c2a1e',
                textLight: '#9a6a4a',
                cardBg: '#ffffff',
                cardBorder: '#fed7aa',
                sidebarBg: '#fffaf7',
                playerBarBg: '#fffaf7',
                hoverBg: '#fff7ed',
                controlBtnBg: '#ffedd5',
                controlBtnHover: '#fed7aa',
                accentLight: '#fff7ed',
                shadow: 'rgba(154, 106, 74, 0.15)'
            },
            {
                name: 'Ночная',
                bg: '#0f172a',
                primary: '#38bdf8',
                primaryHover: '#0ea5e9',
                text: '#f1f5f9',
                textLight: '#94a3b8',
                cardBg: '#1e293b',
                cardBorder: '#334155',
                sidebarBg: '#1a2332',
                playerBarBg: '#1a2332',
                hoverBg: '#273548',
                controlBtnBg: '#334155',
                controlBtnHover: '#475569',
                accentLight: '#1e3a5f',
                shadow: 'rgba(0, 0, 0, 0.3)'
            }
        ];
        
        this.currentThemeIndex = 0;
        this.loadThemePreference();
        
        this.initElements();
        this.setupEventListeners();
        this.applyTheme(this.currentThemeIndex);
        
        this.initDB().then(() => {
            this.loadState();
        });
        
        this.audio.volume = 0.7;
        this.volumeSlider.value = 70;
    }

    // ============ IndexedDB методы (исправленные) ============

    initDB() {
        return new Promise((resolve, reject) => {
            // Удаляем старую базу, если версия не совпадает
            const DB_VERSION = 2;
            const request = indexedDB.open('MusicPlayerDB', DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Удаляем старые хранилища, если они есть
                if (db.objectStoreNames.contains('tracks')) {
                    db.deleteObjectStore('tracks');
                }
                if (db.objectStoreNames.contains('playlists')) {
                    db.deleteObjectStore('playlists');
                }
                if (db.objectStoreNames.contains('settings')) {
                    db.deleteObjectStore('settings');
                }
                
                // Создаём новые хранилища
                db.createObjectStore('tracks', { keyPath: 'id' });
                db.createObjectStore('playlists', { keyPath: 'name' });
                db.createObjectStore('settings', { keyPath: 'key' });
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onerror = (event) => {
                console.error('Ошибка открытия IndexedDB:', event.target.error);
                // Если не удалось открыть, работаем без сохранения
                this.db = null;
                resolve();
            };
            
            request.onblocked = () => {
                console.warn('База данных заблокирована. Закройте другие вкладки с этим приложением.');
                resolve();
            };
        });
    }

    async saveState() {
        if (!this.db) return;
        
        try {
            // Сохраняем треки
            const tx1 = this.db.transaction('tracks', 'readwrite');
            const trackStore = tx1.objectStore('tracks');
            
            await new Promise((resolve, reject) => {
                const clearReq = trackStore.clear();
                clearReq.onsuccess = resolve;
                clearReq.onerror = () => reject(clearReq.error);
            });
            
            for (const track of this.tracks) {
                await new Promise((resolve, reject) => {
                    const addReq = trackStore.put({
                        id: track.id,
                        name: track.name,
                        data: track.data,
                        artist: track.artist || 'Неизвестный исполнитель'
                    });
                    addReq.onsuccess = resolve;
                    addReq.onerror = () => reject(addReq.error);
                });
            }
            
            await new Promise(resolve => { tx1.oncomplete = resolve; });
            
            // Сохраняем плейлисты
            const tx2 = this.db.transaction('playlists', 'readwrite');
            const playlistStore = tx2.objectStore('playlists');
            
            await new Promise((resolve, reject) => {
                const clearReq = playlistStore.clear();
                clearReq.onsuccess = resolve;
                clearReq.onerror = () => reject(clearReq.error);
            });
            
            for (const [name, tracks] of Object.entries(this.playlists)) {
                await new Promise((resolve, reject) => {
                    const addReq = playlistStore.put({
                        name: name,
                        trackIds: tracks.map(t => t.id)
                    });
                    addReq.onsuccess = resolve;
                    addReq.onerror = () => reject(addReq.error);
                });
            }
            
            await new Promise(resolve => { tx2.oncomplete = resolve; });
            
            // Сохраняем текущий плейлист
            const tx3 = this.db.transaction('settings', 'readwrite');
            const settingsStore = tx3.objectStore('settings');
            
            await new Promise((resolve, reject) => {
                const putReq = settingsStore.put({
                    key: 'currentPlaylist',
                    value: this.currentPlaylist
                });
                putReq.onsuccess = resolve;
                putReq.onerror = () => reject(putReq.error);
            });
            
        } catch (e) {
            console.error('Ошибка сохранения в IndexedDB:', e);
        }
    }

    async loadState() {
        if (!this.db) {
            this.renderPlaylists();
            this.renderTrackList();
            return;
        }
        
        try {
            // Загружаем треки
            const trackStore = this.db.transaction('tracks', 'readonly').objectStore('tracks');
            const tracks = await new Promise((resolve, reject) => {
                const req = trackStore.getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            
            this.tracks = tracks.map(t => ({
                id: t.id,
                name: t.name,
                data: t.data,
                artist: t.artist || 'Неизвестный исполнитель',
                url: t.data
            }));
            
            // Загружаем плейлисты
            const playlistStore = this.db.transaction('playlists', 'readonly').objectStore('playlists');
            const playlistsData = await new Promise((resolve, reject) => {
                const req = playlistStore.getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            
            this.playlists = {};
            playlistsData.forEach(pl => {
                this.playlists[pl.name] = pl.trackIds
                    .map(id => this.tracks.find(t => t.id === id))
                    .filter(t => t !== undefined);
            });
            
            // Загружаем настройки
            const settingsStore = this.db.transaction('settings', 'readonly').objectStore('settings');
            const setting = await new Promise((resolve, reject) => {
                const req = settingsStore.get('currentPlaylist');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            
            this.currentPlaylist = (setting && setting.value) || 'all';
            
        } catch (e) {
            console.error('Ошибка загрузки из IndexedDB:', e);
            this.tracks = [];
            this.playlists = {};
            this.currentPlaylist = 'all';
        }
        
        this.renderPlaylists();
        this.renderTrackList();
        
        document.querySelectorAll('.playlist-card').forEach(card => {
            card.classList.remove('active');
            if (card.dataset.playlist === this.currentPlaylist) {
                card.classList.add('active');
            }
        });
        
        this.updateUploadButton();
    }

    // ============ Управление темами ============

    loadThemePreference() {
        try {
            const saved = localStorage.getItem('musicPlayerTheme');
            if (saved !== null) {
                const index = parseInt(saved);
                if (index >= 0 && index < this.themes.length) {
                    this.currentThemeIndex = index;
                }
            }
        } catch (e) {
            console.log('Не удалось загрузить тему');
        }
    }

    saveThemePreference() {
        try {
            localStorage.setItem('musicPlayerTheme', this.currentThemeIndex.toString());
        } catch (e) {
            console.log('Не удалось сохранить тему');
        }
    }

    applyTheme(index) {
        const theme = this.themes[index];
        const root = document.documentElement;
        
        root.style.setProperty('--bg', theme.bg);
        root.style.setProperty('--primary', theme.primary);
        root.style.setProperty('--primary-hover', theme.primaryHover);
        root.style.setProperty('--text', theme.text);
        root.style.setProperty('--text-light', theme.textLight);
        root.style.setProperty('--card-bg', theme.cardBg);
        root.style.setProperty('--card-border', theme.cardBorder);
        root.style.setProperty('--sidebar-bg', theme.sidebarBg);
        root.style.setProperty('--player-bar-bg', theme.playerBarBg);
        root.style.setProperty('--hover-bg', theme.hoverBg);
        root.style.setProperty('--control-btn-bg', theme.controlBtnBg);
        root.style.setProperty('--control-btn-hover', theme.controlBtnHover);
        root.style.setProperty('--accent-light', theme.accentLight);
        root.style.setProperty('--shadow', theme.shadow);
        
        this.currentThemeIndex = index;
        this.saveThemePreference();
        this.renderPlaylists();
    }

    cycleTheme() {
        const nextIndex = (this.currentThemeIndex + 1) % this.themes.length;
        this.applyTheme(nextIndex);
        
        this.themeBtn.style.transform = 'rotate(180deg)';
        setTimeout(() => {
            this.themeBtn.style.transform = 'rotate(0deg)';
        }, 300);
    }

    // ============ Инициализация и события ============

    initElements() {
        this.trackList = document.getElementById('trackList');
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.progress = document.getElementById('progress');
        this.currentTrackEl = document.getElementById('currentTrack');
        this.currentArtistEl = document.getElementById('currentArtist');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        this.audioUpload = document.getElementById('audioUpload');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.playlistsGrid = document.getElementById('playlistsGrid');
        this.addPlaylistBtn = document.getElementById('addPlaylistBtn');
        this.playlistModal = document.getElementById('playlistModal');
        this.playlistNameInput = document.getElementById('playlistName');
        this.cancelPlaylistBtn = document.getElementById('cancelPlaylist');
        this.createPlaylistBtn = document.getElementById('createPlaylist');
        this.addTracksModal = document.getElementById('addTracksModal');
        this.tracksSelection = document.getElementById('tracksSelection');
        this.closeAddTracks = document.getElementById('closeAddTracks');
        this.trackCover = document.getElementById('trackCover');
        this.themeBtn = document.getElementById('themeBtn');
        
        this.volumeBtn = document.getElementById('volumeBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeSliderContainer = document.getElementById('volumeSliderContainer');
        
        this.deletePlaylistModal = document.getElementById('deletePlaylistModal');
        this.deletePlaylistMessage = document.getElementById('deletePlaylistMessage');
        this.cancelDeletePlaylist = document.getElementById('cancelDeletePlaylist');
        this.confirmDeletePlaylist = document.getElementById('confirmDeletePlaylist');
    }

    setupEventListeners() {
        this.audioUpload.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
            this.audioUpload.value = '';
        });

        this.uploadBtn.addEventListener('click', (e) => {
            if (this.currentPlaylist !== 'all') {
                e.preventDefault();
                this.showAddTracksModal();
            }
        });

        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.playPrev());
        this.nextBtn.addEventListener('click', () => this.playNext());
        
        this.progress.addEventListener('input', () => {
            const time = (this.progress.value / 100) * this.audio.duration;
            this.audio.currentTime = time;
        });

        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.playNext());

        this.audio.addEventListener('error', (e) => {
            console.error('Ошибка воспроизведения:', e);
            this.isPlaying = false;
            this.updatePlayerUI();
            this.playNext();
        });

        this.addPlaylistBtn.addEventListener('click', () => this.showPlaylistModal());
        this.cancelPlaylistBtn.addEventListener('click', () => this.hidePlaylistModal());
        this.createPlaylistBtn.addEventListener('click', () => this.createPlaylist());
        this.closeAddTracks.addEventListener('click', () => this.hideAddTracksModal());
        
        this.cancelDeletePlaylist.addEventListener('click', () => this.hideDeletePlaylistModal());
        this.confirmDeletePlaylist.addEventListener('click', () => this.deletePlaylist());
        
        this.playlistsGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('playlist-delete-btn')) {
                e.stopPropagation();
                const card = e.target.closest('.playlist-card');
                if (card && card.dataset.playlist && card.dataset.playlist !== 'all') {
                    this.showDeletePlaylistModal(card.dataset.playlist);
                }
                return;
            }
            
            const card = e.target.closest('.playlist-card');
            if (card && card.dataset.playlist) {
                this.selectPlaylist(card.dataset.playlist);
            }
        });

        this.volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.volumeSliderContainer.classList.toggle('active');
        });

        this.volumeSlider.addEventListener('input', () => {
            this.audio.volume = this.volumeSlider.value / 100;
            this.updateVolumeIcon();
        });

        document.addEventListener('click', (e) => {
            if (!this.volumeSliderContainer.contains(e.target) && 
                e.target !== this.volumeBtn) {
                this.volumeSliderContainer.classList.remove('active');
            }
        });

        this.themeBtn.addEventListener('click', () => this.cycleTheme());

        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayerUI();
        });
        
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayerUI();
        });
    }

    // ============ Загрузка файлов ============

    updateUploadButton() {
        if (this.currentPlaylist === 'all') {
            this.uploadBtn.textContent = '+ Загрузить треки';
            this.uploadBtn.classList.remove('playlist-mode');
            this.uploadBtn.onclick = () => document.getElementById('audioUpload').click();
        } else {
            this.uploadBtn.textContent = '+ Добавить треки';
            this.uploadBtn.classList.add('playlist-mode');
            this.uploadBtn.onclick = (e) => {
                e.preventDefault();
                this.showAddTracksModal();
            };
        }
    }

    handleFileUpload(files) {
        Array.from(files).forEach(file => {
            const isAudio = file.type.startsWith('audio/') || 
                          file.name.match(/\.(mp3|wav|wave|ogg|flac|aac|m4a)$/i);
            
            if (!isAudio) {
                console.log(`Пропущен неаудио файл: ${file.name}`);
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                const track = {
                    id: Date.now() + Math.random(),
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    data: e.target.result,
                    url: e.target.result,
                    artist: 'Неизвестный исполнитель'
                };
                
                this.tracks.push(track);
                this.saveState();
                this.renderTrackList();
            };
            
            reader.onerror = () => {
                console.error(`Ошибка при чтении файла: ${file.name}`);
            };
            
            reader.readAsDataURL(file);
        });
    }

    // ============ Управление плейлистами ============

    showPlaylistModal() {
        this.playlistModal.classList.add('active');
        this.playlistNameInput.focus();
    }

    hidePlaylistModal() {
        this.playlistModal.classList.remove('active');
        this.playlistNameInput.value = '';
    }

    createPlaylist() {
        const name = this.playlistNameInput.value.trim();
        if (name) {
            this.playlists[name] = [];
            this.saveState();
            this.renderPlaylists();
            this.hidePlaylistModal();
        }
    }

    selectPlaylist(playlistId) {
        this.currentPlaylist = playlistId;
        
        document.querySelectorAll('.playlist-card').forEach(card => {
            card.classList.remove('active');
            if (card.dataset.playlist === playlistId) {
                card.classList.add('active');
            }
        });
        
        this.updateUploadButton();
        this.saveState();
        this.renderTrackList();
    }

    showAddTracksModal() {
        this.addTracksModal.classList.add('active');
        this.renderTracksSelection();
    }

    hideAddTracksModal() {
        this.addTracksModal.classList.remove('active');
    }

    renderTracksSelection() {
        const playlistTracks = this.playlists[this.currentPlaylist] || [];
        
        this.tracksSelection.innerHTML = this.tracks.map(track => {
            const isInPlaylist = playlistTracks.some(t => t.id === track.id);
            return `
                <div class="track-select-item ${isInPlaylist ? 'selected' : ''}" 
                     onclick="player.toggleTrackInPlaylist('${track.id}')">
                    <span class="track-name">${track.name}</span>
                    <span class="check-icon">${isInPlaylist ? '✓' : ''}</span>
                </div>
            `;
        }).join('');
    }

    toggleTrackInPlaylist(trackId) {
        if (this.currentPlaylist === 'all') return;
        
        const track = this.tracks.find(t => t.id == trackId);
        if (!track) return;
        
        const playlistTracks = this.playlists[this.currentPlaylist] || [];
        const trackIndex = playlistTracks.findIndex(t => t.id == trackId);
        
        if (trackIndex === -1) {
            playlistTracks.push(track);
        } else {
            playlistTracks.splice(trackIndex, 1);
        }
        
        this.playlists[this.currentPlaylist] = playlistTracks;
        this.saveState();
        this.renderTracksSelection();
        
        if (this.currentPlaylist !== 'all') {
            this.renderTrackList();
        }
    }

    deleteTrack(trackId, event) {
        event.stopPropagation();
        
        const trackIndex = this.tracks.findIndex(t => t.id == trackId);
        if (trackIndex === -1) return;
        
        if (trackIndex === this.currentTrackIndex) {
            this.audio.pause();
            this.audio.src = '';
            this.isPlaying = false;
            this.currentTrackIndex = -1;
            this.updatePlayerUI();
        } else if (trackIndex < this.currentTrackIndex) {
            this.currentTrackIndex--;
        }
        
        Object.keys(this.playlists).forEach(playlistName => {
            this.playlists[playlistName] = this.playlists[playlistName].filter(t => t.id != trackId);
        });
        
        this.tracks.splice(trackIndex, 1);
        
        this.saveState();
        this.renderTrackList();
        this.renderPlaylists();
    }

    showDeletePlaylistModal(playlistName) {
        this.playlistToDelete = playlistName;
        this.deletePlaylistMessage.textContent = `Вы действительно хотите удалить плейлист "${playlistName}"?`;
        this.deletePlaylistModal.classList.add('active');
    }

    hideDeletePlaylistModal() {
        this.deletePlaylistModal.classList.remove('active');
        this.playlistToDelete = null;
    }

    deletePlaylist() {
        if (this.playlistToDelete && this.playlists[this.playlistToDelete]) {
            if (this.currentPlaylist === this.playlistToDelete) {
                this.selectPlaylist('all');
            }
            
            delete this.playlists[this.playlistToDelete];
            this.saveState();
            this.renderPlaylists();
        }
        this.hideDeletePlaylistModal();
    }

    // ============ Отрисовка ============

    getCurrentTracks() {
        if (this.currentPlaylist === 'all') {
            return this.tracks;
        }
        return this.playlists[this.currentPlaylist] || [];
    }

    renderTrackList() {
        const currentTracks = this.getCurrentTracks();
        
        if (currentTracks.length === 0) {
            this.trackList.innerHTML = `
                <div style="text-align: center; color: var(--text-light); padding: 40px;">
                    ${this.currentPlaylist === 'all' ? 
                        'Загрузите треки, чтобы начать' : 
                        'Добавьте треки в этот плейлист'}
                </div>
            `;
        } else {
            this.trackList.innerHTML = currentTracks.map((track, index) => `
                <li class="track-item ${this.isCurrentTrack(track) ? 'active' : ''}">
                    <span onclick="player.playTrackByIndex(${index})" style="flex: 1;">
                        ${track.name}
                    </span>
                    <button class="track-delete-btn" 
                            onclick="player.deleteTrack('${track.id}', event)" 
                            title="Удалить трек">
                        ✕
                    </button>
                </li>
            `).join('');
        }
    }

    isCurrentTrack(track) {
        if (this.currentTrackIndex === -1 || !track) return false;
        const currentTrack = this.tracks[this.currentTrackIndex];
        return currentTrack && currentTrack.id === track.id;
    }

    renderPlaylists() {
        const allPlaylistsHTML = `
            <div class="playlist-card ${this.currentPlaylist === 'all' ? 'active' : ''}" 
                 data-playlist="all">
                <span>Все треки</span>
            </div>
        `;
        
        const customPlaylistsHTML = Object.keys(this.playlists).map(name => {
            const emoji = this.getPlaylistEmoji();
            return `
                <div class="playlist-card ${this.currentPlaylist === name ? 'active' : ''}" 
                     data-playlist="${name}">
                    <span>${emoji} ${name}</span>
                    <button class="playlist-delete-btn" title="Удалить плейлист">✕</button>
                </div>
            `;
        }).join('');
        
        this.playlistsGrid.innerHTML = allPlaylistsHTML + customPlaylistsHTML;
    }

    // ============ Воспроизведение ============

    playTrackByIndex(index) {
        const currentTracks = this.getCurrentTracks();
        if (index >= 0 && index < currentTracks.length) {
            const globalIndex = this.tracks.indexOf(currentTracks[index]);
            if (globalIndex !== -1) {
                this.playTrack(globalIndex);
            }
        }
    }

    playTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            const track = this.tracks[index];
            
            this.audio.pause();
            this.audio.src = track.data;
            this.currentTrackIndex = index;
            
            const playPromise = this.audio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.renderTrackList();
                }).catch(error => {
                    console.error('Ошибка воспроизведения:', error);
                    this.isPlaying = false;
                    this.updatePlayerUI();
                });
            }
        }
    }

    togglePlay() {
        if (this.currentTrackIndex === -1 && this.tracks.length > 0) {
            this.playTrack(0);
            return;
        }

        if (this.audio.paused) {
            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Ошибка воспроизведения:', error);
                    this.isPlaying = false;
                    this.updatePlayerUI();
                });
            }
        } else {
            this.audio.pause();
        }
    }

    playNext() {
        const currentTracks = this.getCurrentTracks();
        if (currentTracks.length === 0) return;
        
        const currentTrack = this.tracks[this.currentTrackIndex];
        const currentIndexInPlaylist = currentTracks.findIndex(t => t.id === currentTrack?.id);
        
        if (currentIndexInPlaylist < currentTracks.length - 1 && currentIndexInPlaylist !== -1) {
            const nextTrack = currentTracks[currentIndexInPlaylist + 1];
            const globalIndex = this.tracks.indexOf(nextTrack);
            if (globalIndex !== -1) {
                this.playTrack(globalIndex);
            }
        } else {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
            this.updatePlayerUI();
        }
    }

    playPrev() {
        const currentTracks = this.getCurrentTracks();
        if (currentTracks.length === 0) return;
        
        const currentTrack = this.tracks[this.currentTrackIndex];
        const currentIndexInPlaylist = currentTracks.findIndex(t => t.id === currentTrack?.id);
        
        if (currentIndexInPlaylist > 0) {
            const prevTrack = currentTracks[currentIndexInPlaylist - 1];
            const globalIndex = this.tracks.indexOf(prevTrack);
            if (globalIndex !== -1) {
                this.playTrack(globalIndex);
            }
        }
    }

    updateProgress() {
        if (this.audio.duration) {
            const progress = (this.audio.currentTime / this.audio.duration) * 100;
            this.progress.value = progress;
            this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateDuration() {
        this.durationEl.textContent = this.formatTime(this.audio.duration);
    }

    updatePlayerUI() {
        this.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
        
        if (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.tracks.length) {
            const track = this.tracks[this.currentTrackIndex];
            this.currentTrackEl.textContent = track.name;
            this.currentArtistEl.textContent = track.artist || 'Неизвестный исполнитель';
            this.trackCover.innerHTML = '<span class="cover-placeholder">🎵</span>';
        } else {
            this.currentTrackEl.textContent = 'Нет трека';
            this.currentArtistEl.textContent = 'Неизвестный исполнитель';
            this.trackCover.innerHTML = '<span class="cover-placeholder">🎵</span>';
        }
    }

    updateVolumeIcon() {
        const volume = this.audio.volume;
        if (volume === 0) {
            this.volumeBtn.textContent = '🔇';
        } else if (volume < 0.5) {
            this.volumeBtn.textContent = '🔉';
        } else {
            this.volumeBtn.textContent = '🔊';
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    getPlaylistEmoji() {
        const emojis = ['🐟', '🌻', '🌲', '🌅', '✨'];
        return emojis[this.currentThemeIndex] || '📁';
    }
}

// Инициализация плеера
const player = new MusicPlayer();
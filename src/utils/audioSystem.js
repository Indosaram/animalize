/**
 * Animalize Audio System
 * Ported from original Chrome Extension by Joshua Sherry
 */

class AudioSystem {
  constructor() {
    this.audioCtx = null;
    this.gainNode = null;

    // Configuration with persistence
    const saved = JSON.parse(localStorage.getItem('animalize_config') || '{}');
    this.vol = saved.vol !== undefined ? saved.vol : 0.5;
    this.config = saved.config !== undefined ? saved.config : 0; // 0 = all, 1 = animalese, 2 = sfx
    this.pitch_shift = saved.pitch_shift !== undefined ? saved.pitch_shift : 0.0;

    // Default constants
    this.v_type = "voice_1";
    this.g_type = "female";
    this.pitch_variation = 0.2;
    this.intonation = 0.0;

    this.isActive = true;

    // Cache decoded buffers to avoid fetching repeatedly
    this.bufferCache = new Map();

    this.initPhoneticMap();
    this.updatePaths();
  }

  saveConfig() {
    const config = {
      vol: this.vol,
      config: this.config,
      pitch_shift: this.pitch_shift
    };
    localStorage.setItem('animalize_config', JSON.stringify(config));
  }

  setVolume(val) {
    this.vol = val;
    this.saveConfig();
  }

  setConfig(val) {
    this.config = val;
    this.saveConfig();
  }

  setPitchShift(val) {
    this.pitch_shift = val;
    this.saveConfig();
  }

  initPhoneticMap() {
    const phonemeToRegexMap = {
      'a': ['ㅋ', 'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ā', 'ă', 'ą', 'ǎ'],
      'A': ['À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ā', 'Ă', 'Ą', 'Ǎ'],
      'b': ['ㅣ', 'ḃ', 'ḅ', 'ḇ'],
      'B': ['Ḃ', 'Ḅ', 'Ḇ'],
      'c': ['ㅠ', 'ç', 'ć', 'ĉ', 'ċ', 'č'],
      'C': ['Ç', 'Ć', 'Ĉ', 'Ċ', 'Č'],
      'd': ['ㅍ', 'ď', 'đ', 'ḋ', 'ḍ', 'ḏ', 'ḑ', 'ḓ'],
      'D': ['Ď', 'Đ', 'Ḋ', 'Ḍ', 'Ḏ', 'Ḑ', 'Ḓ'],
      'e': ['ㄷ', 'è', 'é', 'ê', 'ë', 'ē', 'ĕ', 'ė', 'ę', 'ě', 'ẹ', 'ẻ', 'ẽ', 'ế', 'ề', 'ể', 'ễ', 'ệ', 'ğ'],
      'E': ['È', 'É', 'Ê', 'Ë', 'Ē', 'Ĕ', 'Ė', 'Ę', 'Ě', 'Ẹ', 'Ẻ', 'Ẽ', 'Ế', 'Ề', 'Ể', 'Ễ', 'Ệ', 'Ğ'],
      'f': ['ㅎ', 'ẟ'],
      'F': [],
      'g': ['ㅏ', 'ĝ', 'ğ', 'ġ', 'ģ', 'ḡ'],
      'G': ['Ĝ', 'Ğ', 'Ġ', 'Ģ', 'Ḡ'],
      'h': ['ㅑ', 'ĥ', 'ȟ', 'ḥ', 'ḧ', 'ḩ', 'ḫ', 'ẖ'],
      'H': ['Ĥ', 'Ȟ', 'Ḥ', 'Ḧ', 'Ḩ', 'Ḫ'],
      'i': ['ㅇ', 'ì', 'í', 'î', 'ï', 'ĩ', 'ī', 'ĭ', 'į', 'ı', 'ỉ', 'ị'],
      'I': ['Ì', 'Í', 'Î', 'Ï', 'Ĩ', 'Ī', 'Ĭ', 'Į', 'İ', 'Ỉ', 'Ị'],
      'j': ['ㅓ', 'ĵ', 'ǰ'],
      'J': ['Ĵ'],
      'k': ['ㅕ', 'ķ', 'ḱ', 'ḳ', 'ḵ', 'ƙ'],
      'K': ['Ķ', 'Ḱ', 'Ḳ', 'Ḵ', 'Ƙ'],
      'l': ['ㅗ', 'ĺ', 'ļ', 'ľ', 'ŀ', 'ł', 'ḷ', 'ḹ', 'ḻ', 'ḽ'],
      'L': ['Ĺ', 'Ļ', 'Ľ', 'Ŀ', 'Ł', 'Ḷ', 'Ḹ', 'Ḻ', 'Ḽ'],
      'm': ['ㅔ', 'ḿ', 'ṁ', 'ṃ'],
      'M': ['ㅖ', 'Ḿ', 'Ṁ', 'Ṃ'],
      'n': ['ㅐ', 'ñ', 'ń', 'ņ', 'ň', 'ŉ', 'ŋ', 'ṇ', 'ṉ', 'ṋ', 'ṋ'],
      'N': ['ㅒ', 'Ñ', 'Ń', 'Ņ', 'Ň', 'Ŋ', 'Ṇ', 'Ṉ', 'Ṋ'],
      'o': ['ㅈ', 'ò', 'ó', 'ô', 'õ', 'ö', 'ø', 'ō', 'ŏ', 'ő', 'ơ', 'ǫ', 'ǭ', 'ọ', 'ỏ', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ'],
      'O': ['ㅉ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ø', 'Ō', 'Ŏ', 'Ő', 'Ơ', 'Ǫ', 'Ǭ', 'Ọ', 'Ỏ', 'Ố', 'Ồ', 'Ổ', 'Ỗ', 'Ộ', 'Ớ', 'Ờ', 'Ở', 'Ỡ', 'Ợ'],
      'p': ['ㅊ', 'ṕ', 'ṗ'],
      'P': ['Ṕ', 'Ṗ'],
      'q': ['ㄱ', 'ɋ'],
      'Q': [],
      'r': ['ㄹ', 'ŕ', 'ŗ', 'ř', 'ȑ', 'ȓ', 'ṙ', 'ṛ', 'ṝ', 'ṟ'],
      'R': ['Ŕ', 'Ŗ', 'Ř', 'Ȑ', 'Ȓ', 'Ṙ', 'Ṛ', 'Ṝ', 'Ṟ'],
      's': ['ㅌ', 'ß', 'ś', 'ŝ', 'ş', 'š', 'ṡ', 'ṣ', 'ṥ', 'ṧ', 'ṩ', 'ẛ'],
      'S': ['Ś', 'Ŝ', 'Ş', 'Š', 'Ṡ', 'Ṣ', 'Ṥ', 'Ṧ', 'Ṩ'],
      't': ['ㅁ', 'ţ', 'ť', 'ŧ', 'ṫ', 'ṭ', 'ṯ', 'ṱ', 'ẗ'],
      'T': ['Ţ', 'Ť', 'Ŧ', 'Ṫ', 'Ṭ', 'Ṯ', 'Ṱ'],
      'u': ['ㅅ', 'ù', 'ú', 'û', 'ü', 'ũ', 'ū', 'ŭ', 'ů', 'ű', 'ų', 'ư', 'ṳ', 'ṵ', 'ṷ', 'ṹ', 'ṻ', 'ụ', 'ủ', 'ứ', 'ừ', 'ử', 'ữ', 'ự'],
      'U': ['ㅆ', 'Ù', 'Ú', 'Û', 'Ü', 'Ũ', 'Ū', 'Ŭ', 'Ů', 'Ű', 'Ų', 'Ư', 'Ṳ', 'Ṵ', 'Ṷ', 'Ṹ', 'Ṻ', 'Ụ', 'Ủ', 'Ứ', 'Ừ', 'Ử', 'Ữ', 'Ự'],
      'v': ['ㅡ', 'ṿ', 'ʋ'],
      'V': ['Ṿ'],
      'w': ['ㄴ', 'ŵ', 'ẁ', 'ẃ', 'ẅ', 'ẇ', 'ẉ', 'ẘ'],
      'W': ['Ŵ', 'Ẁ', 'Ẃ', 'Ẅ', 'Ẇ', 'Ẉ'],
      'x': ['ㅜ', 'ẋ', 'ẍ'],
      'X': ['Ẋ', 'Ẍ'],
      'y': ['ㅂ', 'ý', 'ÿ', 'ŷ', 'ȳ', 'ẏ', 'ẙ', 'ỳ', 'ỵ', 'ỷ', 'ỹ'],
      'Y': ['ㅃ', 'Ý', 'Ŷ', 'Ȳ', 'Ẏ', 'Ỳ', 'Ỵ', 'Ỷ', 'Ỹ'],
      'z': ['ㅛ', 'ź', 'ż', 'ž', 'ẑ', 'ẓ', 'ẕ', 'ȥ'],
      'Z': ['Ź', 'Ż', 'Ž', 'Ẑ', 'Ẓ', 'Ẕ']
    };

    this.charToPhoneme = {};
    for (const [phoneme, chars] of Object.entries(phonemeToRegexMap)) {
      for (const char of chars) {
        this.charToPhoneme[char] = phoneme;
      }
    }
  }

  updatePaths() {
    this.audio_vocals = [
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/0`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/1`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/2`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/3`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/4`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/5`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/6`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/7`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/8`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/9`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/10`,
      `/assets/audio/vocals/${this.g_type}/${this.v_type}/11`
    ];
    this.audio_arrows = [
      '/assets/audio/sfx/arrow_left',
      '/assets/audio/sfx/arrow_up',
      '/assets/audio/sfx/arrow_right',
      '/assets/audio/sfx/arrow_down'
    ];
    this.audio_deksa = `/assets/audio/animalese/${this.g_type}/${this.v_type}/Deska`;
    this.audio_gwah = `/assets/audio/animalese/${this.g_type}/${this.v_type}/Gwah`;
    this.audio_ok = `/assets/audio/animalese/${this.g_type}/${this.v_type}/OK`;
    this.audio_special = {
      "default": '/assets/audio/sfx/default',
      "back": '/assets/audio/sfx/backspace',
      "enter": '/assets/audio/sfx/enter',
      "tab": '/assets/audio/sfx/tab',
      "?": '/assets/audio/sfx/question',
      "~": '/assets/audio/sfx/tilde',
      "!": '/assets/audio/sfx/exclamation',
      "@": '/assets/audio/sfx/at',
      "#": '/assets/audio/sfx/pound',
      "$": '/assets/audio/sfx/dollar',
      "%": '/assets/audio/sfx/percent',
      "^": '/assets/audio/sfx/caret',
      "&": '/assets/audio/sfx/ampersand',
      "*": '/assets/audio/sfx/asterisk',
      "(": '/assets/audio/sfx/parenthesis_open',
      ")": '/assets/audio/sfx/parenthesis_closed',
      "[": '/assets/audio/sfx/bracket_open',
      "]": '/assets/audio/sfx/bracket_closed',
      "{": '/assets/audio/sfx/brace_open',
      "}": '/assets/audio/sfx/brace_closed',
      "/": '/assets/audio/sfx/slash_forward',
      "\\": '/assets/audio/sfx/slash_back'
    };
  }

  isAlpha(str) {
    return (str.length === 1) ? (/\p{Letter}/u).test(str.charAt(0)) : false;
  }

  isUpperCase(str) {
    return str === str.toUpperCase();
  }

  isMoney(str) {
    return (str.length === 1) ? (/[$£€¥₩₱¢\u0024\u00a3\u20ac\u00a5\u20a9\u20b1\u00a2]/).test(str.charAt(0)) : false;
  }

  isWhitespace(str) {
    return (str.length === 1) ? (/\s/).test(str.charAt(0)) : false;
  }

  getLetterSound(key) {
    key = key.charAt(0);
    if ((/[a-zA-Z]/).test(key)) return key;
    const letter = this.charToPhoneme[key] || null;
    return letter;
  }

  async playAudio(audioPath, volume, randomPitch = 0.0, pitch = 0.0, useProfile = false) {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    try {
      let buffer = this.bufferCache.get(audioPath);
      if (!buffer) {
        const response = await fetch(audioPath + '.aac'); // Assuming .aac as per original code
        if (!response.ok) throw new Error(`Failed to load sound: ${audioPath}`);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        this.bufferCache.set(audioPath, buffer);
      }

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;

      const gainNode = this.audioCtx.createGain();
      gainNode.gain.value = volume * this.vol * 0.95;
      gainNode.connect(this.audioCtx.destination);

      source.connect(gainNode);

      // Pitch shifting - make it more noticeable
      const baseShift = useProfile ? this.pitch_shift * 200 : 0.0; // pitch_shift is -0.5 to 0.5, multiply by 200 for -100 to 100 cents
      const variation = useProfile ? this.pitch_variation : 0.0;
      const randomFactor = (Math.random() * 600 - 300);
      const detuneValue = baseShift + pitch * 100 + (randomFactor * (variation + randomPitch));
      source.detune.value = detuneValue;
      console.log("Pitch shift applied:", detuneValue, "baseShift:", this.pitch_shift);

      if (useProfile && this.intonation !== 0) {
        source.playbackRate.setValueAtTime(source.playbackRate.value, this.audioCtx.currentTime);
        source.playbackRate.exponentialRampToValueAtTime(1 + (this.intonation * 0.8), this.audioCtx.currentTime + 0.4);
      }

      source.start();

    } catch (e) {
      console.error("Audio playback error:", e);
    }
  }

  handleInput(key, keyCode, startAudioContext = false) {
    if (startAudioContext && !this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!this.isActive) return;

    console.log("handleInput key:", key, "config:", this.config);

    // Arrow keys
    if (key.startsWith("Arrow")) {
      const arrowMap = {
        "ArrowLeft": 0,
        "ArrowUp": 1,
        "ArrowRight": 2,
        "ArrowDown": 3
      };
      const arrowIndex = arrowMap[key];
      if (arrowIndex !== undefined) {
        this.playAudio(this.audio_arrows[arrowIndex], 0.4);
      }
      return;
    }

    // Backspace / Delete
    if (key === "Backspace" || key === "Delete") {
      this.playAudio(this.audio_special['back'], 1.0);
      return;
    }

    // Enter
    if (key === "Enter") {
      this.playAudio(this.audio_special['enter'], 0.2);
      return;
    }

    // Tab
    if (key === "Tab") {
      this.playAudio(this.audio_special['tab'], 0.5);
      return;
    }

    // Space
    if (key === "Space" || key === " ") {
      this.playAudio(this.audio_special['default'], 0.3);
      return;
    }

    // Escape
    if (key === "Escape") {
      this.playAudio(this.audio_special['default'], 0.3);
      return;
    }

    // Special characters mapping (play in all modes except Animalese-only for some)
    if (this.audio_special[key]) {
      this.playAudio(this.audio_special[key], 0.6);
      return;
    }

    // Numbers & Vocals
    if (!isNaN(parseInt(key)) && key.length === 1) {
      if (this.config === 2) return; // SFX only mode skips vocals
      const num = parseInt(key);
      if (num >= 1 && num <= 9) this.playAudio(this.audio_vocals[num - 1], 1.0, 0, 0, true);
      else if (num === 0) this.playAudio(this.audio_vocals[9], 1.0, 0, 0, true);
      return;
    }

    // Alphabet
    if (this.isAlpha(key)) {
      if (this.config === 2) return; // SFX only mode skips vocals
      const letter = this.getLetterSound(key);
      if (!letter) return;

      const audioPath = `/assets/audio/animalese/${this.g_type}/${this.v_type}/${letter.toLowerCase()}`;

      if (this.isUpperCase(key)) {
        this.playAudio(audioPath, 0.7, 0.15, 1.6, true);
      } else {
        this.playAudio(audioPath, 0.5, 0.0, 0, true);
      }
      return;
    }

    // Default fallback for unknown keys
    this.playAudio(this.audio_special["default"], 0.4, 0.4);
  }
}

export const audioSystem = new AudioSystem();

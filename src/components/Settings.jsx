import { useState, useEffect } from 'react';
import { audioSystem } from '../utils/audioSystem';

const Settings = () => {
    const [vol, setVol] = useState(audioSystem.vol);
    const [mode, setMode] = useState(audioSystem.config);
    const [pitch, setPitch] = useState(audioSystem.pitch_shift * 10 || 0);

    const handleVolChange = (e) => {
        const newVal = parseFloat(e.target.value);
        setVol(newVal);
        audioSystem.setVolume(newVal);
    };

    const handleModeChange = (newMode) => {
        setMode(newMode);
        audioSystem.setConfig(newMode);
    };

    const handlePitchChange = (e) => {
        const newVal = parseFloat(e.target.value);
        setPitch(newVal);
        // Pitch shift is usually small float, e.g., 0.1, 0.2. Slider might be 1-10.
        audioSystem.setPitchShift(newVal / 10.0);
    };

    return (
        <div className="settings-container">
            <h2>Settings</h2>

            <div className="setting-item">
                <label>Volume: {Math.round(vol * 100)}%</label>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={vol}
                    onChange={handleVolChange}
                />
            </div>

            <div className="setting-item">
                <label>Sound Mode</label>
                <div className="button-group">
                    <button
                        className={mode === 0 ? 'active' : ''}
                        onClick={() => handleModeChange(0)}>
                        All
                    </button>
                    <button
                        className={mode === 1 ? 'active' : ''}
                        onClick={() => handleModeChange(1)}>
                        Animalese
                    </button>
                    <button
                        className={mode === 2 ? 'active' : ''}
                        onClick={() => handleModeChange(2)}>
                        SFX
                    </button>
                </div>
            </div>

            <div className="setting-item">
                <label>Pitch Shift: {pitch}</label>
                <input
                    type="range"
                    min="-5"
                    max="5"
                    step="1"
                    value={pitch}
                    onChange={handlePitchChange}
                />
            </div>

            <p className="hint">
                Typing will make sounds even if this window is in the background.
            </p>
        </div>
    );
};

export default Settings;

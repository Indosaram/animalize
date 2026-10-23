# 🐾 Animalize

**Animalize** is a cute desktop application that detects your keyboard input and plays Animal Crossing style sound effects (Animalese) in real-time. Add a touch of magic to your daily typing!

## ✨ Key Features

- **Real-time Sound Response:** Plays unique Animal Crossing voices and sound effects corresponding to each key press.
- **Diverse Voice Profiles:** Choose between Male and Female voices with multiple tone options (Voice 1~4).
- **Global Key Detection:** Even when the app is in the background, it detects system-wide key inputs to play sounds.
- **Simple UI:** Intuitive and adorable design allows you to easily toggle sounds and adjust volume.

## 📸 Screenshots

*(Add your screenshots here)*

## 📖 How to Use

1.  **Launch the App:** Open Animalize. The app will start running in the background.
2.  **Start Typing:** Open any application (Notepad, Browser, Slack, etc.) and start typing. You will hear the cute Animalese sounds!
3.  **Adjust Settings:**
    *   Click the **Tray Icon** (in the taskbar/menu bar) and select **Show** to open the settings window.
    *   **Volume:** Use the slider to adjust the sound level.
    *   **Sound Mode:**
        *   **All:** Plays both voices and special sound effects.
        *   **Animalese:** Plays only the voices.
        *   **SFX:** Plays only sound effects (like typing noises).
    *   **Voice & Pitch:** Select your preferred voice type (Male/Female) and adjust the pitch slider to customize the tone.

## 🚀 Getting Started

### Prerequisites

To build this project from source, you will need:

- [Rust](https://www.rust-lang.org/) (Tauri Backend)
- [Node.js](https://nodejs.org/) or [Bun](https://bun.sh/) (Frontend)

### Running in Development

```bash
# Install dependencies
bun install

# Run the app
bun tauri dev
```

### Building the App

```bash
bun tauri build
```

## 캐릭터 목소리 / 크롬 확장 (한국어)

- **캐릭터 목소리**: 치이카와 느낌, 하치와레 느낌, 우사기 느낌, 쿠리만쥬 느낌, 기본 동물 목소리(남/여 1~4) 중에서 고를 수 있어요. 높낮이·빠르기·흔들림·삑삑 소리를 직접 조절하거나 내 소리 파일로 목소리를 만들 수도 있어요. 캐릭터 목소리는 분위기를 흉내 낸 합성 효과이며 공식 음성이 아닙니다.
- **데스크탑 앱**: `bun install` 후 `bun tauri dev`. macOS에서는 다른 앱의 타자를 듣기 위해 '손쉬운 사용' 권한이 필요하며, 앱 안에서 안내해 줘요.
- **크롬 확장**: `bun run build:ext` 후 `extension/dist` 폴더를 크롬에 로드해요. 자세한 순서는 [extension/README.md](extension/README.md)를 보세요.
- **캐릭터 진짜 소리 넣기**: 캐릭터를 고른 뒤 "캐릭터 진짜 소리 넣기" 칸에 짧은 소리 파일(하앗, 와아 같은 것, mp3·wav·m4a / 파일당 1MB 이하 / 캐릭터마다 12개까지)을 끌어다 놓으면, 타자를 칠 때 그 소리 중 하나가 매번 바뀌어 가며 나와요. 소리 파일은 사용자가 직접 준비해야 하며, 내 컴퓨터에만 저장돼요. 저작권이 있는 소리를 공유하거나 배포하면 안 돼요. 이 저장소에는 캐릭터 실제 음성이 들어 있지 않아요.
- **테스트**: `bun run test` (목소리 엔진 단위 테스트)

## 🎨 Design & Assets

- **Font:** Arial Rounded MT Bold
- **Sound Effects:** Inspired by the sound resources of the Animal Crossing series.
- **Design Concept:** Soft and friendly UI/UX with a pastel color palette.

## 📄 License

This project was created for educational and personal use. Copyright for sound and image assets belongs to their respective owners.

---

[Visit the Project Homepage](https://Indosaram.github.io/animalize/)

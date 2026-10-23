use tauri::Emitter;
use std::thread;

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

/// Reports whether the OS lets this app observe global key presses.
#[tauri::command]
fn accessibility_status() -> String {
    #[cfg(target_os = "macos")]
    {
        if unsafe { AXIsProcessTrusted() } { "granted".into() } else { "denied".into() }
    }
    #[cfg(not(target_os = "macos"))]
    {
        "unsupported".into()
    }
}

/// Opens the macOS Accessibility privacy pane so the user can grant permission.
#[tauri::command]
fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            use device_query::{DeviceQuery, DeviceState, Keycode};
            use std::time::Duration;

            thread::spawn(move || {
                let device_state = DeviceState::new();
                let mut prev_keys: Vec<Keycode> = vec![];

                loop {
                    let keys: Vec<Keycode> = device_state.get_keys();
                    let is_shift = keys.contains(&Keycode::LShift) || keys.contains(&Keycode::RShift);

                    // Emit only newly pressed keys as "KeyName,isShift".
                    for key in &keys {
                        if !prev_keys.contains(key) {
                            let payload = format!("{:?},{}", key, is_shift);
                            let _ = app_handle.emit("global-keydown", payload);
                        }
                    }

                    prev_keys = keys;
                    thread::sleep(Duration::from_millis(20));
                }
            });

            use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder, Manager, image::Image};

            let show_i = MenuItem::with_id(app, "show", "설정 열기", true, None::<&str>)?;
            let toggle_i = MenuItem::with_id(app, "toggle", "소리 켜기/끄기", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &toggle_i, &quit_i])?;

            let icon_bytes = include_bytes!("../icons/icon.png");
            let icon_image = image::load_from_memory(icon_bytes).expect("Failed to load icon");
            let resized = icon_image.resize(32, 32, image::imageops::FilterType::Lanczos3);
            let (width, height) = (resized.width(), resized.height());
            let rgba = resized.into_rgba8().into_vec();
            let icon = Image::new_owned(rgba, width, height);

            let _tray = TrayIconBuilder::with_id("tray")
                .icon(icon)
                .tooltip("Animalize")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "toggle" => {
                        let _ = app.emit("tray-toggle", ());
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![accessibility_status, open_accessibility_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

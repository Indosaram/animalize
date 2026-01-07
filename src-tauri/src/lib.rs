// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri::Emitter;
use std::thread;

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
                    
                    // Detect new key presses (present in current but not in prev)
                    for key in &keys {
                        if !prev_keys.contains(key) {
                            let key_str = format!("{:?}", key);
                            // Emit JSON string or object? strings are easier to parse simply if we format it: "Key|Shift"
                            // But let's use a simple JSON via string format since we didn't add serde_json for this specifically (though tauri uses it).
                            // Actually app_handle.emit accepts a Serialize type.
                            // Let's just send a struct-like tuple or map if we can, or just append modifier to string "SHIFT_Key1"
                            
                            // Simplest: Send an event object. Tauri emit handles serialization of JSON-compatible types if serde is derived, but Keycode probably isn't.
                            // We are formatting Keycode to string. 
                            // Let's invoke a slightly richer payload as a helper string: "KeyName,IsShift"
                            let payload = format!("{},{}", key_str, is_shift);
                            let _ = app_handle.emit("global-keydown", payload);
                        }
                    }

                    prev_keys = keys;
                    thread::sleep(Duration::from_millis(20)); // Poll every 20ms
                }
            });

            use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder, Manager, image::Image};

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let icon_bytes = include_bytes!("../icons/icon.png");
            let icon_image = image::load_from_memory(icon_bytes).expect("Failed to load icon");
            
            // Resize icon to 32x32 for macOS menu bar (template size)
            let resized = icon_image.resize(32, 32, image::imageops::FilterType::Lanczos3);
            let (width, height) = (resized.width(), resized.height());
            let rgba = resized.into_rgba8().into_vec();
            let icon = Image::new_owned(rgba, width, height);

            let _tray = TrayIconBuilder::with_id("tray")
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
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
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

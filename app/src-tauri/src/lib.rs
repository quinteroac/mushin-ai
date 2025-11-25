#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // Enable logging for both debug and release builds
      // Logs will be saved to app data directory
      let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Info // More verbose in debug
      } else {
        log::LevelFilter::Error // Only errors in release
      };
      
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log_level)
          .build(),
      )?;
      
      // Log startup info
      log::info!("Mushin started");
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

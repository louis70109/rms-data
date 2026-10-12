// RMS 攻略庫 桌面版：Tauri 外殼。畫面與功能全部是網站的 index.html（打包時內嵌進執行檔），
// 用 Windows 內建的 WebView2 顯示，不需要網路。外部連結由網頁端用 opener 外掛交給系統瀏覽器。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("啟動 RMS 攻略庫失敗");
}

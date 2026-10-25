// RMS 攻略庫 桌面版：Tauri 外殼。畫面與功能全部是網站的 index.html（打包時內嵌進執行檔），
// 用 Windows 內建的 WebView2 顯示，不需要網路。外部連結由網頁端用 opener 外掛交給系統瀏覽器。
// 啟動時會檢查 GitHub Release 上的 latest.json：有新版本就詢問使用者，同意才下載、驗證簽章並安裝。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

async fn check_for_update(app: AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(_) => return,
    };
    let update = match updater.check().await {
        Ok(Some(u)) => u,
        _ => return,
    };
    let msg = format!("發現新版本 {}，要現在更新嗎？", update.version);
    let yes = app
        .dialog()
        .message(msg)
        .title("RMS 攻略庫")
        .buttons(MessageDialogButtons::OkCancelCustom("立即更新".into(), "稍後".into()))
        .blocking_show();
    if !yes {
        return;
    }
    if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
        app.restart();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(check_for_update(handle));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("啟動 RMS 攻略庫失敗");
}

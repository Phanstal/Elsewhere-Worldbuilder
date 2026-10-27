use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let new_world = MenuItem::with_id(app, "new-world", "New World", true, Some("CmdOrCtrl+N"))?;
    let save = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;
    let export_elsew = MenuItem::with_id(
        app,
        "export-elsew",
        "Export World (.elsew)…",
        true,
        Some("CmdOrCtrl+Shift+E"),
    )?;
    let export_png = MenuItem::with_id(
        app,
        "export-png",
        "Export Image (PNG)…",
        true,
        Some("CmdOrCtrl+Shift+P"),
    )?;
    let close_window = PredefinedMenuItem::close_window(app, Some("Close Window"))?;
    let file_separator_one = PredefinedMenuItem::separator(app)?;
    let file_separator_two = PredefinedMenuItem::separator(app)?;

    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_world,
            &save,
            &file_separator_one,
            &export_elsew,
            &export_png,
            &file_separator_two,
            &close_window,
        ],
    )?;

    let undo = MenuItem::with_id(app, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
    let redo = MenuItem::with_id(app, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
    let cut = PredefinedMenuItem::cut(app, Some("Cut"))?;
    let copy = PredefinedMenuItem::copy(app, Some("Copy"))?;
    let paste = PredefinedMenuItem::paste(app, Some("Paste"))?;
    let select_all = PredefinedMenuItem::select_all(app, Some("Select All"))?;
    let edit_separator_one = PredefinedMenuItem::separator(app)?;
    let edit_separator_two = PredefinedMenuItem::separator(app)?;

    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &edit_separator_one,
            &cut,
            &copy,
            &paste,
            &edit_separator_two,
            &select_all,
        ],
    )?;

    let zoom_in = MenuItem::with_id(app, "zoom-in", "Zoom In", true, Some("CmdOrCtrl+Plus"))?;
    let zoom_out = MenuItem::with_id(app, "zoom-out", "Zoom Out", true, Some("CmdOrCtrl+-"))?;
    let fit = MenuItem::with_id(app, "fit", "Fit Canvas", true, Some("CmdOrCtrl+0"))?;
    let toggle_explore = MenuItem::with_id(
        app,
        "toggle-explore",
        "Toggle Explore Mode",
        true,
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let fullscreen = PredefinedMenuItem::fullscreen(app, Some("Toggle Full Screen"))?;
    let view_separator_one = PredefinedMenuItem::separator(app)?;
    let view_separator_two = PredefinedMenuItem::separator(app)?;
    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &zoom_in,
            &zoom_out,
            &fit,
            &view_separator_one,
            &toggle_explore,
            &view_separator_two,
            &fullscreen,
        ],
    )?;

    let minimize = PredefinedMenuItem::minimize(app, Some("Minimize"))?;
    let window = Submenu::with_items(app, "Window", true, &[&minimize])?;

    #[cfg(target_os = "macos")]
    let app_menu = {
        let about = PredefinedMenuItem::about(app, Some("About Elsewhere"), None)?;
        let services = PredefinedMenuItem::services(app, Some("Services"))?;
        let hide = PredefinedMenuItem::hide(app, Some("Hide Elsewhere"))?;
        let hide_others = PredefinedMenuItem::hide_others(app, Some("Hide Others"))?;
        let show_all = PredefinedMenuItem::show_all(app, Some("Show All"))?;
        let quit = PredefinedMenuItem::quit(app, Some("Quit Elsewhere"))?;
        let app_separator_one = PredefinedMenuItem::separator(app)?;
        let app_separator_two = PredefinedMenuItem::separator(app)?;
        let app_separator_three = PredefinedMenuItem::separator(app)?;
        Submenu::with_items(
            app,
            "Elsewhere",
            true,
            &[
                &about,
                &app_separator_one,
                &services,
                &app_separator_two,
                &hide,
                &hide_others,
                &show_all,
                &app_separator_three,
                &quit,
            ],
        )?
    };

    #[cfg(target_os = "macos")]
    let menu = Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])?;

    #[cfg(not(target_os = "macos"))]
    let menu = Menu::with_items(app, &[&file, &edit, &view, &window])?;

    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        let command = match event.id().as_ref() {
            "new-world" => Some("new-world"),
            "undo" => Some("undo"),
            "redo" => Some("redo"),
            "save" => Some("save"),
            "export-elsew" => Some("export-elsew"),
            "export-png" => Some("export-png"),
            "zoom-in" => Some("zoom-in"),
            "zoom-out" => Some("zoom-out"),
            "fit" => Some("fit"),
            "toggle-explore" => Some("toggle-explore"),
            _ => None,
        };

        if let Some(command) = command {
            let _ = app.emit("elsewhere://command", command);
        }
    });

    Ok(())
}

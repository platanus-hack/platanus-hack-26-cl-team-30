// Clave y script del tema, sin React: los usa el layout (componente de servidor)
// para fijar data-theme en el <head> antes de pintar, y theme.ts en el navegador.
// El deck del pitch (public/pitch/index.html) repite la misma regla con la misma clave.

export const THEME_KEY = "sculptor:theme";

/** Script inline del <head>: fija data-theme (lo elegido o el sistema) antes del primer pintado. */
export const THEME_SCRIPT = `(function(){try{var t=null;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t}catch(e){}})();`;

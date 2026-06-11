import { createIcons } from 'lucide';

/**
 * Show a toast notification at the bottom-right of the screen.
 * @param {'success' | 'error' | 'info'} alertStyle
 */
export function dispatchNotification(headline, bodyText, alertStyle = 'success') {
    const toastBox = document.getElementById('toastContainer');
    if (!toastBox) return;

    const el = document.createElement('div');

    let colorStyling = 'border-indigo-500/30 bg-indigo-950/95';
    let iconMarkup = `<i data-lucide="check-circle-2" class="w-5 h-5 text-indigo-400 shrink-0"></i>`;

    if (alertStyle === 'error') {
        colorStyling = 'border-rose-500/30 bg-rose-950/95';
        iconMarkup = `<i data-lucide="alert-octagon" class="w-5 h-5 text-rose-400 shrink-0"></i>`;
    } else if (alertStyle === 'info') {
        colorStyling = 'border-slate-700/50 bg-slate-900/95';
        iconMarkup = `<i data-lucide="help-circle" class="w-5 h-5 text-slate-300 shrink-0"></i>`;
    }

    el.className = `p-4 rounded-xl border ${colorStyling} text-white shadow-2xl flex items-start gap-3 w-[340px] pointer-events-auto transition-all duration-300 opacity-100 translate-y-0`;
    el.innerHTML = `
        ${iconMarkup}
        <div class="flex-1 space-y-0.5">
            <p class="text-xs font-bold uppercase tracking-wider text-white">${headline}</p>
            <p class="text-[11px] text-slate-300 leading-relaxed font-medium">${bodyText}</p>
        </div>
        <button class="toast-dismiss text-slate-400 hover:text-white transition">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;

    // Dismiss on X click
    el.querySelector('.toast-dismiss')?.addEventListener('click', () => el.remove());

    toastBox.appendChild(el);
    createIcons();

    // Auto-dismiss after 4.5 s
    setTimeout(() => {
        el.classList.replace('opacity-100', 'opacity-0');
        el.classList.replace('translate-y-0', 'translate-y-8');
        setTimeout(() => el.remove(), 300);
    }, 4500);
}

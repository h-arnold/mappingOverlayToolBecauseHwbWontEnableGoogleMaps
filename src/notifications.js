import { createIcons, icons } from 'lucide';

/**
 * Show a toast notification at the bottom-right of the screen.
 * @param {'success' | 'error' | 'info'} alertStyle
 */
export function dispatchNotification(headline, bodyText, alertStyle = 'success') {
    const toastBox = document.getElementById('toastContainer');
    if (!toastBox) return;

    const el = document.createElement('div');

    let colorStyling = 'border-indigo-500/30 bg-white shadow-lg';
    let iconMarkup = `<i data-lucide="check-circle-2" class="w-5 h-5 text-indigo-500 shrink-0"></i>`;

    if (alertStyle === 'error') {
        colorStyling = 'border-rose-500/30 bg-white shadow-lg';
        iconMarkup = `<i data-lucide="alert-octagon" class="w-5 h-5 text-rose-500 shrink-0"></i>`;
    } else if (alertStyle === 'info') {
        colorStyling = 'border-stone-300/50 bg-white shadow-lg';
        iconMarkup = `<i data-lucide="help-circle" class="w-5 h-5 text-stone-600 shrink-0"></i>`;
    }

    el.className = `p-4 rounded-xl border ${colorStyling} text-stone-900 flex items-start gap-3 w-[340px] pointer-events-auto transition-all duration-300 opacity-100 translate-y-0`;
    el.innerHTML = `
        ${iconMarkup}
        <div class="flex-1 space-y-0.5">
            <p class="text-xs font-bold uppercase tracking-wider text-stone-900">${headline}</p>
            <p class="text-[11px] text-stone-600 leading-relaxed font-medium">${bodyText}</p>
        </div>
        <button class="toast-dismiss text-stone-400 hover:text-stone-800 transition">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;

    // Dismiss on X click
    el.querySelector('.toast-dismiss')?.addEventListener('click', () => el.remove());

    toastBox.appendChild(el);
    createIcons({ icons });

    // Auto-dismiss after 4.5 s
    setTimeout(() => {
        el.classList.remove('opacity-100', 'translate-y-0');
        el.classList.add('opacity-0', 'translate-y-8');
        setTimeout(() => el.remove(), 300);
    }, 4500);
}

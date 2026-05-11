import { fetchEmails } from './emailService.js';

/**
 * Replaces a target container's content with real Gmail data fetched from the backend.
 * Uses exact class names and structure from your existing UI to prevent breakage.
 * 
 * @param {string} containerId - The ID of the DOM element where emails should be rendered
 */
export async function renderEmails(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[emailUI] Container #${containerId} not found.`);
        return;
    }

    // 1. Show Loading State (matching your UI aesthetic)
    container.innerHTML = `
        <div class="flex justify-center items-center p-8 w-full">
            <span class="material-symbols-outlined animate-spin text-primary-container text-4xl">progress_activity</span>
            <span class="ml-3 font-body text-on-surface-variant">Fetching live emails...</span>
        </div>
    `;

    try {
        // 2. Fetch Real Data (using the service created earlier)
        const emails = await fetchEmails();

        // 3. Handle Empty State
        if (!emails || emails.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-on-surface-variant w-full bg-surface-container-lowest rounded-xl border border-outline-variant">
                    <span class="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                    <p class="font-body">No emails found</p>
                </div>
            `;
            return;
        }

        // 4. Map & Render Data (Preserving existing UI classes exactly)
        container.innerHTML = ''; // Clear loading spinner
        
        emails.forEach(email => {
            // Format timestamp 
            const dateStr = new Date(email.timestamp).toLocaleDateString(undefined, { 
                year: 'numeric', month: 'short', day: 'numeric' 
            });

            const card = document.createElement('div');
            // EXACT classes pulled from search_orig.html matching the UI structure
            card.className = "bg-surface-container-lowest rounded-xl border border-outline-variant p-lg flex flex-col gap-sm hover:border-outline transition-colors cursor-pointer relative overflow-hidden group mb-4";
            
            card.innerHTML = `
                <!-- Decorative Left Border -->
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#ea4335] rounded-l-xl opacity-80"></div>
                
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-sm">
                        <!-- Gmail Icon -->
                        <div class="w-8 h-8 rounded-full bg-[#ea4335]/10 flex items-center justify-center text-[#ea4335]">
                            <span class="material-symbols-outlined text-lg">mail</span>
                        </div>
                        
                        <!-- Header Details -->
                        <div>
                            <h4 class="font-h3 text-h3 text-base text-on-surface">${email.subject || 'No Subject'}</h4>
                            <p class="font-body text-body text-xs text-on-surface-variant">From: ${email.from} • ${dateStr}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Snippet / Preview -->
                <p class="font-body text-body text-sm text-on-surface-variant mt-xs line-clamp-2">
                    ${email.snippet || ''}
                </p>
            `;
            
            container.appendChild(card);
        });

    } catch (error) {
        // 5. Handle Error State
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-error w-full bg-error-container/10 rounded-xl border border-error/30">
                <span class="material-symbols-outlined text-4xl mb-2">error</span>
                <p class="font-body">Unable to load emails. Please try again later.</p>
            </div>
        `;
    }
}

let currentLang = 'en';
let renderedCount = 0;
let activeIndex = 0;
const batchSize = 24;

const galleryGrid = document.getElementById('galleryGrid');
const galleryCount = document.getElementById('galleryCount');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const zipStatus = document.getElementById('zipStatus');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxCounter = document.getElementById('lightboxCounter');
const lightboxDownload = document.getElementById('lightboxDownload');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

const translations = {
    en: {
        photos: 'photos',
        showing: 'Showing',
        of: 'of',
        preparing: 'Preparing ZIP. This may take a little while for large galleries...',
        fetching: 'Adding',
        generating: 'Generating ZIP',
        ready: 'Gallery ZIP is ready.',
        partial: 'ZIP ready. Some images could not be added.',
        unavailable: 'ZIP download needs JSZip to load. Please try again with an internet connection or use a prebuilt server-side ZIP.',
        empty: 'No gallery photos are listed yet.',
        photo: 'Photo'
    },
    hu: {
        photos: 'kép',
        showing: 'Megjelenítve',
        of: '/',
        preparing: 'ZIP előkészítése. Nagy galériáknál ez eltarthat egy ideig...',
        fetching: 'Hozzáadás',
        generating: 'ZIP készítése',
        ready: 'A galéria ZIP elkészült.',
        partial: 'A ZIP elkészült. Néhány képet nem sikerült hozzáadni.',
        unavailable: 'A ZIP letöltéshez a JSZip betöltése szükséges. Próbáld újra internetkapcsolattal, vagy használj előre elkészített szerveroldali ZIP-et.',
        empty: 'Még nincs kép a galériában.',
        photo: 'Kép'
    }
};

function t(key) {
    return translations[currentLang][key];
}

function getTitle(item) {
    return currentLang === 'hu' && item.titleHu ? item.titleHu : item.title;
}

function translatePage(lang) {
    document.querySelectorAll('.translate').forEach(el => {
        const translation = el.getAttribute(`data-${lang}`);
        if (translation) {
            el.textContent = translation;
        }
    });
    updateCount();
    document.querySelectorAll('.gallery-card').forEach(card => {
        const index = Number(card.dataset.index);
        const item = GALLERY_ITEMS[index];
        if (!item) {
            return;
        }
        const title = getTitle(item);
        card.setAttribute('aria-label', title);
        card.querySelector('img').alt = title;
        card.querySelector('span').textContent = title;
    });
    if (!lightbox.hidden) {
        updateLightbox(activeIndex);
    }
}

function updateCount() {
    if (!GALLERY_ITEMS.length) {
        galleryCount.textContent = t('empty');
        return;
    }
    galleryCount.textContent = `${t('showing')} ${renderedCount} ${t('of')} ${GALLERY_ITEMS.length} ${t('photos')}`;
}

function renderNextBatch() {
    const nextItems = GALLERY_ITEMS.slice(renderedCount, renderedCount + batchSize);
    const fragment = document.createDocumentFragment();

    nextItems.forEach((item, offset) => {
        const index = renderedCount + offset;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gallery-card';
        button.setAttribute('aria-label', getTitle(item));
        button.dataset.index = index;

        const image = document.createElement('img');
        image.src = item.thumbnail;
        image.alt = getTitle(item);
        image.loading = 'lazy';
        image.decoding = 'async';

        const caption = document.createElement('span');
        caption.textContent = getTitle(item);

        button.append(image, caption);
        button.addEventListener('click', () => openLightbox(index));
        fragment.appendChild(button);
    });

    galleryGrid.appendChild(fragment);
    renderedCount += nextItems.length;
    loadMoreBtn.hidden = renderedCount >= GALLERY_ITEMS.length;
    updateCount();
}

function openLightbox(index) {
    activeIndex = index;
    updateLightbox(index);
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lightboxClose.focus();
}

function updateLightbox(index) {
    const item = GALLERY_ITEMS[index];
    activeIndex = index;
    lightboxImage.src = item.original;
    lightboxImage.alt = getTitle(item);
    lightboxTitle.textContent = getTitle(item);
    lightboxCounter.textContent = `${index + 1} / ${GALLERY_ITEMS.length}`;
    lightboxDownload.href = item.original;
    lightboxDownload.download = item.filename || item.original.split('/').pop() || `hunghanians-photo-${index + 1}.jpg`;
}

function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = 'auto';
    lightboxImage.removeAttribute('src');
}

function showPrevious() {
    updateLightbox((activeIndex - 1 + GALLERY_ITEMS.length) % GALLERY_ITEMS.length);
}

function showNext() {
    updateLightbox((activeIndex + 1) % GALLERY_ITEMS.length);
}

function sanitizeFilename(filename, index) {
    const fallback = `hunghanians-photo-${index + 1}.jpg`;
    return (filename || fallback).replace(/[\\/:*?"<>|]+/g, '-');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadAllImages() {
    if (!window.JSZip) {
        zipStatus.textContent = t('unavailable');
        return;
    }

    downloadAllBtn.disabled = true;
    zipStatus.textContent = t('preparing');

    const zip = new JSZip();
    let failed = 0;

    for (const [index, item] of GALLERY_ITEMS.entries()) {
        zipStatus.textContent = `${t('fetching')} ${index + 1} / ${GALLERY_ITEMS.length}`;
        try {
            const response = await fetch(item.original);
            if (!response.ok) {
                throw new Error(`Could not fetch ${item.original}`);
            }
            const blob = await response.blob();
            zip.file(sanitizeFilename(item.filename, index), blob);
        } catch (error) {
            failed += 1;
            console.warn(error);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    zipStatus.textContent = `${t('generating')} 0%`;
    const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'STORE' },
        metadata => {
            zipStatus.textContent = `${t('generating')} ${Math.round(metadata.percent)}%`;
        }
    );

    downloadBlob(zipBlob, 'hunghanians-gallery.zip');
    zipStatus.textContent = failed ? t('partial') : t('ready');
    downloadAllBtn.disabled = false;
}

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLang = btn.dataset.lang;
        translatePage(currentLang);
    });
});

menuToggle.addEventListener('click', () => {
    const isExpanded = navLinks.classList.toggle('active');
    menuToggle.setAttribute('aria-expanded', isExpanded);
});

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
    });
});

document.addEventListener('click', e => {
    if (!document.querySelector('.nav').contains(e.target)) {
        navLinks.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
    }
});

lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', showPrevious);
lightboxNext.addEventListener('click', showNext);
lightbox.addEventListener('click', e => {
    if (e.target === lightbox) {
        closeLightbox();
    }
});

document.addEventListener('keydown', e => {
    if (lightbox.hidden) {
        return;
    }

    if (e.key === 'Escape') {
        closeLightbox();
    }

    if (e.key === 'ArrowLeft') {
        showPrevious();
    }

    if (e.key === 'ArrowRight') {
        showNext();
    }
});

loadMoreBtn.addEventListener('click', renderNextBatch);
downloadAllBtn.addEventListener('click', downloadAllImages);

if (GALLERY_ITEMS.length) {
    renderNextBatch();
} else {
    loadMoreBtn.hidden = true;
    downloadAllBtn.disabled = true;
    updateCount();
}

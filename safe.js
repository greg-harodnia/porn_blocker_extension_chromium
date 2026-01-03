const STORAGE_KEYS = {
    userNotes: "userNotes"
};

function sendMessage(msg) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(msg, (response) => resolve(response));
        } catch (_e) {
            resolve(null);
        }
    });
}

async function loadNotes() {
    try {
        const obj = await chrome.storage.local.get(STORAGE_KEYS.userNotes);
        return obj[STORAGE_KEYS.userNotes] || [];
    } catch (error) {
        console.error('Error loading notes:', error);
        return [];
    }
}

async function saveNotes(notes) {
    try {
        await chrome.storage.local.set({ [STORAGE_KEYS.userNotes]: notes });
    } catch (error) {
        console.error('Error saving notes:', error);
    }
}

function createNoteElement(note, index) {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'note';
    noteDiv.innerHTML = `
    <textarea class="note-textarea" placeholder="Write your thoughts here..." data-index="${index}">${note.text}</textarea>
    <div class="note-timestamp">${new Date(note.timestamp).toLocaleString()}</div>
    <button class="delete-note-btn" data-index="${index}">Delete</button>
  `;

    // Add auto-save functionality
    const textarea = noteDiv.querySelector('.note-textarea');
    let autoSaveTimer;
    textarea.addEventListener('input', () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            updateNoteText(index, textarea.value);
        }, 1000);
    });

    // Add delete functionality
    const deleteBtn = noteDiv.querySelector('.delete-note-btn');
    deleteBtn.addEventListener('click', () => {
        deleteNote(index);
    });

    return noteDiv;
}

async function renderNotes() {
    const container = document.getElementById('notesContainer');
    const notes = await loadNotes();

    if (notes.length === 0) {
        container.innerHTML = '<div class="empty-notes">No notes yet. Click "Add Note" to start reflecting.</div>';
        return;
    }

    container.innerHTML = '';
    // Reverse order to show newest first
    const reversedNotes = [...notes].reverse();
    reversedNotes.forEach((note, reversedIndex) => {
        const originalIndex = notes.length - 1 - reversedIndex;
        container.appendChild(createNoteElement(note, originalIndex));
    });
}

async function addNewNote() {
    const notes = await loadNotes();
    const newNote = {
        text: '',
        timestamp: new Date().toISOString()
    };

    notes.push(newNote);
    await saveNotes(notes);
    await renderNotes();

    // Focus on the new note and scroll to top
    setTimeout(() => {
        const textareas = document.querySelectorAll('.note-textarea');
        if (textareas.length > 0) {
            textareas[0].focus(); // Focus on first (newest) note
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
        }
    }, 100);
}

async function updateNoteText(index, text) {
    const notes = await loadNotes();
    if (notes[index]) {
        notes[index].text = text;
        await saveNotes(notes);
    }
}

async function deleteNote(index) {
    if (confirm('Are you sure you want to delete this note?')) {
        const notes = await loadNotes();
        notes.splice(index, 1);
        await saveNotes(notes);
        await renderNotes();
    }
}

function getOriginalUrl() {
    // Try to get URL from query parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const queryUrl = urlParams.get('url');
    if (queryUrl && queryUrl !== 'about:blank') {
        return queryUrl;
    }

    // Try to get URL from referrer
    if (document.referrer && document.referrer !== '') {
        return document.referrer;
    }

    return 'about:blank';
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    await renderNotes();

    // Setup event listeners
    document.getElementById('addNoteBtn').addEventListener('click', addNewNote);

    // Add keyboard shortcut for new note (Ctrl+N)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            addNewNote();
        }
    });
});

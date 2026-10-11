// Shim for 'electron/filesystem' module in mobile (WebView) context.
// Only getDrafts/saveDrafts are used (by learn/conversation-draft-cache), but they have to
// be real: a no-op here is why message drafts never survived a restart on mobile (issue #27).
// Backed by NativeFile instead of Node fs, keeping the desktop's per-character `drafts.txt`
// layout so a backup moved between Horizon and Solstice carries drafts either way.
//
// NativeFile is Promise-based on both hosts, so getDrafts resolves rather than returning;
// the draft cache awaits it.

const DRAFT_FILE = 'drafts.txt';

// Required lazily: chat/core pulls in the application, and this module is loaded from it.
function currentCharacter() {
    return require('../../chat/core').default.connection.character;
}

async function getDrafts() {
    const character = currentCharacter();
    if (!character) return null;

    let raw;
    try {
        raw = await NativeFile.read(`${character}/${DRAFT_FILE}`);
    } catch (e) {
        console.error('Error encountered when reading drafts', e);
        return null;
    }
    if (raw == null) return null;

    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error('Error encountered when parsing drafts', e);
        return null;
    }
}

async function saveDrafts(drafts) {
    const character = currentCharacter();
    if (!character) return;

    try {
        // Android's NativeFile.write does not create parent directories (iOS does), and the
        // character folder may not exist yet when the first draft is saved on a fresh install.
        await NativeFile.ensureDirectory(character);
        await NativeFile.write(`${character}/${DRAFT_FILE}`, JSON.stringify(drafts));
    } catch (e) {
        console.error('Error encountered when saving drafts', e);
    }
}

module.exports = { getDrafts, saveDrafts };

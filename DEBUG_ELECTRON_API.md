# 🔍 Debug Electron API

## Run This in Console (F12)

After restarting the app, run this in the browser console:

```javascript
// Check what's actually in electronAPI
console.log('=== ELECTRON API DEBUG ===');
console.log('electronAPI exists:', typeof window.electronAPI !== 'undefined');
console.log('electronAPI:', window.electronAPI);
console.log('electronAPI keys:', Object.keys(window.electronAPI || {}));
console.log('getSystemInfo type:', typeof window.electronAPI?.getSystemInfo);
console.log('getSystemInfo value:', window.electronAPI?.getSystemInfo);

// Try to call it
if (typeof window.electronAPI?.getSystemInfo === 'function') {
  console.log('✅ getSystemInfo is a function, calling it...');
  window.electronAPI.getSystemInfo().then(result => {
    console.log('✅ Result:', result);
  }).catch(err => {
    console.error('❌ Error:', err);
  });
} else {
  console.error('❌ getSystemInfo is NOT a function');
  console.log('Available methods:', Object.keys(window.electronAPI || {}));
}
```

## Expected Output (if working):

```
=== ELECTRON API DEBUG ===
electronAPI exists: true
electronAPI: {system: {...}, testPreload: f, getSystemInfo: f, ...}
electronAPI keys: ['system', 'testPreload', 'getSystemInfo', 'sendToMain', ...]
getSystemInfo type: function
getSystemInfo value: () => ipcRenderer.invoke('get-system-info')
✅ getSystemInfo is a function, calling it...
✅ Result: {success: true, data: {computerName: "...", ...}}
```

## If getSystemInfo is Missing:

The output will show which methods ARE available. This will help us understand what's being loaded.

## Steps to Fix:

1. **Stop the app** (Ctrl+C)
2. **Clear caches:**
   ```bash
   Remove-Item -Recurse -Force node_modules/.vite
   ```
3. **Restart:**
   ```bash
   npm start
   ```
4. **Run the debug script above in console**
5. **Share the output** so we can see what's actually loaded

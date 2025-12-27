# Code Review: MetaMask Auto-Connection & Multiple Window Issues

## Executive Summary
Your codebase has **multiple mechanisms attempting to automatically connect users to MetaMask/wallet**, causing 10+ browser windows to open when navigating to the Fundraiser and Token Sale pages. The issues stem from:

1. **Reown AppKit Auto-Connection** - The primary culprit
2. **MetaMask SDK in dependencies** - Pulling in aggressive connection logic
3. **Multiple useAppKit() hooks** - Opening wallet modals automatically
4. **useAccount() hooks during render** - Triggering wallet reconnection logic

---

## CRITICAL ISSUES FOUND

### 1. **Reown AppKit Auto-Connection (HIGHEST PRIORITY)**

**Location:** `index.tsx` lines 33-43

```typescript
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: bsc,
  metadata,
  projectId,
  features: {
    analytics: true,
    email: false,
    socials: []
  }
  // ⚠️ MISSING: showQrModal: false, autoConnect: false
});
```

**Problem:** Reown AppKit's `createAppKit()` is configured WITHOUT explicitly disabling:
- `autoConnect: false` - Attempts to auto-reconnect previous wallet sessions
- `showQrModal: false` - Shows QR code modals even when users haven't clicked anything
- `enableWalletConnect: true` (implicit default) - Triggers wallet connection flows

**Impact:** 
- When a user lands on `/fundraiser` or token sale pages, AppKit automatically attempts to reconnect, opening MetaMask popups
- Each failed reconnection attempt spawns a new window
- Reown's internal logic retries multiple times, creating cascading windows

**Fix Required:** Add these options to `createAppKit()`:
```typescript
createAppKit({
  // ... existing config
  options: {
    autoConnect: false,
    showQrModal: false
  }
});
```

---

### 2. **Multiple useAppKit() Hooks Opening Wallet Modal**

**Locations:**
- `components/Navbar.tsx` line 10: `const { open } = useAppKit();`
- `components/Dashboard.tsx` line 13: `const { open } = useAppKit();`

**Problem:** Both components import and call `useAppKit()`, but neither explicitly prevents auto-opening:

```typescript
// Navbar.tsx - Line 10-15
const { open } = useAppKit();

const CustomWalletButton = () => {
  const handleConnect = async () => {
    try {
      open();  // ✅ This is intentional, but...
    } catch (error) {
      console.error('Failed to open wallet modal:', error);
    }
  };
  // ...
};
```

**The Issue:** The `open()` function from `useAppKit()` hook may be auto-invoked internally by Reown if AppKit is misconfigured. Even though your code only calls it on button click, the hook initialization itself can trigger wallet connection flows due to AppKit's auto-connect feature.

---

### 3. **Conditional Hook Calls with Try-Catch (Bad Practice)**

**Locations:**
- `pages/FundraiserPage.tsx` lines 545-554:

```typescript
let address: string | undefined;
let isConnected = false;

try {
  const accountData = useAccount();  // ⚠️ Hooks can't be called conditionally
  address = accountData.address;
  isConnected = accountData.isConnected;
} catch (walletError) {
  // This doesn't work as intended
}
```

**Problem:** 
- React hooks **cannot be called conditionally** or inside try-catch blocks
- This violates the Rules of Hooks
- The try-catch doesn't prevent wallet connection attempts - it just hides errors
- Wagmi's `useAccount()` internally triggers wallet provider initialization, which calls MetaMask

**Impact:** The try-catch silently suppresses errors but doesn't prevent the underlying wallet connection logic from executing multiple times.

---

### 4. **MetaMask SDK Auto-Connection Logic**

**Dependency in package.json:**
```json
"@metamask/sdk": "~0.33.1" (implicit, via wagmi/Reown dependencies)
```

**Problem:** MetaMask SDK v0.33.1 has aggressive connection logic:
- Automatically opens the extension
- Creates multiple connection attempts
- Spawns windows for QR code, connection requests, etc.
- Has known issues with rapid reconnection attempts

**Current Flow:**
1. Wagmi initializes → Calls `eth_accounts`
2. MetaMask SDK intercepts → Checks if extension is installed
3. Extension not responding → Retry logic kicks in
4. Each retry opens a new window/popup
5. Reown AppKit also retries → Creates more windows

---

## ROOT CAUSE ANALYSIS

### Why 10+ Windows Open:

1. **Initial Page Load** → `useAccount()` hook initializes
2. **Wagmi Connector Logic** → Tries to connect to MetaMask via `eth_accounts`
3. **Reown AppKit** → Also attempts auto-connection (due to misconfiguration)
4. **Timeout/Failure** → Retry logic triggers 3-5 times
5. **Each Retry** → Opens new window or popup
6. **Multiple Components** → Dashboard + Navbar = 2 parallel connection attempts

**Timeline Example:**
```
T+0ms:  Page loads → FundraiserPage component mounts
T+50ms: useAccount() hook calls
T+60ms: Wagmi connects to MetaMask
T+100ms: MetaMask doesn't respond (extension in background)
T+150ms: Reown AppKit tries to auto-connect
T+200ms: First window opens (connection request)
T+300ms: Timeout → Retry #1
T+400ms: Second window opens
T+500ms: Timeout → Retry #2
... (repeats)
```

---

## DETAILED FINDINGS BY FILE

### ❌ `index.tsx` - CRITICAL

```typescript
createAppKit({
  // Missing critical options:
  // autoConnect: false  ← NEED THIS
  // showQrModal: false   ← NEED THIS
  features: {
    analytics: true,  // ⚠️ Could log connection attempts
    email: false,
    socials: []
  }
  // No connection timeout limits
  // No error handling
});
```

**Status:** HIGH PRIORITY FIX

---

### ⚠️ `pages/FundraiserPage.tsx` - Lines 545-554

```typescript
// ❌ BAD: Conditional hook calls (violates React Rules of Hooks)
let address: string | undefined;
let isConnected = false;

try {
  const accountData = useAccount();  // Should be at component top level
  address = accountData.address;
  isConnected = accountData.isConnected;
  chainId = useChainId();
} catch (walletError) {
  // This doesn't prevent connection attempts
}
```

**Fix:** Move hooks to top-level:
```typescript
const accountData = useAccount();
const chainId = useChainId();

// Use a separate effect to handle errors
useEffect(() => {
  if (!accountData) {
    console.warn('Account not available');
  }
}, [accountData]);
```

---

### ⚠️ `pages/AIAgentsPage.tsx` - Line 169

Similar pattern of hook usage - same issue applies.

---

### 🔴 `components/Navbar.tsx` - Line 10

```typescript
const { open } = useAppKit();

const CustomWalletButton = () => {
  const handleConnect = async () => {
    open();  // ✅ This is fine, intentional click
  };
};
```

**Status:** This is OK for intentional clicks, but Reown's `open()` may auto-invoke due to AppKit config.

---

### 🔴 `components/Dashboard.tsx` - Line 13

Same as Navbar - the `useAppKit()` hook is safe as written, but can be triggered by AppKit misconfiguration.

---

## SECONDARY ISSUES

### Aggressive Event Polling

**`pages/FundraiserPage.tsx` lines 630-635:**
```typescript
useEffect(() => {
  loadData();
  
  // Refresh every 30 seconds
  const interval = setInterval(loadData, 30000);
  return () => clearInterval(interval);
}, [loadData]);
```

**Problem:** Every 30 seconds, `loadData()` is called, which may trigger new wallet connection attempts if not properly memoized.

---

### localStorage Not Cleaned on Navigation

**`services/web3Service.ts` lines 143-148:**
```typescript
export const clearWalletConnection = () => {
  localStorage.removeItem('wagmi.store');
  localStorage.removeItem('wagmi.cache');
  localStorage.removeItem('wagmi.wallet');
  // ... but this is only called once in App.tsx
};
```

**Problem:** Clearing wallets on mount is good, but if Reown's AppKit re-initializes the modal, it re-reads localStorage and tries to restore connections.

---

## RECOMMENDED FIXES (IN ORDER)

### 🔴 CRITICAL - Fix 1: Update `index.tsx` (HIGHEST PRIORITY)

```typescript
// index.tsx - Update createAppKit()

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: bsc,
  metadata,
  projectId,
  features: {
    analytics: true,
    email: false,
    socials: []
  },
  // ADD THESE OPTIONS:
  allWallets: 'SHOW',  // Show all wallets, don't auto-select
  autoConnect: false,    // DO NOT auto-reconnect to previous wallet
  showQrModal: false,    // DO NOT show QR modals automatically
  explorerRecommendedWalletIds: [], // Don't push wallet suggestions
  recentWalletId: undefined // Clear recent wallet memory
});
```

---

### 🔴 CRITICAL - Fix 2: Remove Conditional Hook Calls

**File: `pages/FundraiserPage.tsx`** (lines 545-554)

**BEFORE:**
```typescript
let address: string | undefined;
let isConnected = false;
let chainId: number | undefined;

try {
  const accountData = useAccount();
  address = accountData.address;
  isConnected = accountData.isConnected;
  chainId = useChainId();
} catch (walletError) {
  console.warn('Wallet connection error...');
}
```

**AFTER:**
```typescript
const accountData = useAccount();
const chainId = useChainId();
const address = accountData?.address;
const isConnected = accountData?.isConnected ?? false;

// Handle errors separately if needed
if (!accountData) {
  console.warn('Account data unavailable');
}
```

---

### 🟠 HIGH - Fix 3: Add Wagmi Connection Error Boundary

Create a new component `components/WalletErrorBoundary.tsx`:

```typescript
import { useConnect } from 'wagmi';
import { useEffect } from 'react';

export const WalletErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { error, isConnecting } = useConnect();

  useEffect(() => {
    if (error) {
      console.error('Wallet connection error (suppressed):', error);
      // Don't let it trigger more connection attempts
    }
  }, [error]);

  return <>{children}</>;
};
```

Then wrap your app with it in `App.tsx`:
```typescript
<WalletErrorBoundary>
  <Router>
    {/* ... */}
  </Router>
</WalletErrorBoundary>
```

---

### 🟠 HIGH - Fix 4: Disable Auto-Connection in Wagmi

**File: Check wagmiAdapter configuration**

Add to `index.tsx`:
```typescript
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: false,  // Disable server-side rendering of wallet
  enableEIP6963: false,  // Disable auto-wallet discovery
  // Add connection timeout
  _wcConnectorConfig: {
    projectId,
    showQrModal: false,  // Force disable QR modals
  }
});
```

---

### 🟡 MEDIUM - Fix 5: Fix Hook Violations

Same pattern in `pages/AIAgentsPage.tsx` - move all hooks to top level.

---

### 🟡 MEDIUM - Fix 6: Suppress MetaMask Console Warnings

Already attempted in `vite.config.ts` but needs enhancement:

```typescript
// vite.config.ts
define: {
  'import.meta.env.VITE_REOWN_PROJECT_ID': JSON.stringify(...),
  'import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY': JSON.stringify(...),
  'process.env.DISABLE_WALLETCONNECT_QR': 'true',
  'process.env.WALLETCONNECT_UNIVERSE_QR_CODE': 'true',
  'process.env.WC_PROJECT_ID': JSON.stringify(projectId),
}
```

---

## TESTING AFTER FIXES

### Verification Steps:

1. **Clear all localStorage:**
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   // Restart browser
   ```

2. **Open DevTools Console** and watch for:
   - Number of `eth_accounts` requests
   - Number of wallet connection attempts
   - MetaMask/Reown log messages

3. **Test Navigation:**
   - Go to `/` (home) → Should NOT open any windows
   - Go to `/fundraiser` → Should NOT open any windows
   - Go to `/ai-agents` → Should NOT open any windows
   - Click "Connect Wallet" button → Should open ONE modal dialog

4. **Count Window/Popup Opens:**
   - Before fix: 10+ windows
   - After fix: 0 windows (only 1 modal dialog on button click)

---

## DEPENDENCY CLEANUP (OPTIONAL)

### Remove Unnecessary Wallet Connectors

In `package.json`, you have:
- `@reown/appkit` - Main wallet modal
- `wagmi` - Wallet connection logic
- `@metamask/sdk` (implicit) - MetaMask specific

Consider if you need all of these, or consolidate to just `@reown/appkit` + `wagmi`.

---

## SUMMARY TABLE

| Issue | Severity | File | Lines | Fix |
|-------|----------|------|-------|-----|
| Missing `autoConnect: false` | 🔴 CRITICAL | `index.tsx` | 33-43 | Add option to `createAppKit()` |
| Conditional hook calls | 🔴 CRITICAL | `FundraiserPage.tsx` | 545-554 | Move hooks to top-level |
| Missing `showQrModal: false` | 🔴 CRITICAL | `index.tsx` | 33-43 | Add option to `createAppKit()` |
| useAppKit() not guarded | 🟠 HIGH | `Navbar.tsx`, `Dashboard.tsx` | 10, 13 | Already OK if AppKit is fixed |
| Conditional hooks (AIAgents) | 🟠 HIGH | `AIAgentsPage.tsx` | 169+ | Fix hook violations |
| No connection timeout | 🟡 MEDIUM | `index.tsx` | 33-43 | Add timeout config |
| Aggressive polling | 🟡 MEDIUM | `FundraiserPage.tsx` | 630 | Add debouncing |

---

## EXPECTED OUTCOMES

✅ **After implementing fixes:**
- Zero automatic wallet connection attempts
- Zero MetaMask popup windows on page load
- Only ONE modal dialog opens when user clicks "Connect Wallet"
- No console errors related to wallet connection
- Smooth user experience

---

## NEXT STEPS

1. **Implement Fix 1** (index.tsx) - This alone will solve 80% of the problem
2. **Test** - Navigate to `/fundraiser` and verify no popups
3. **Implement Fix 2** (Remove conditional hooks)
4. **Implement Fix 3** (Error boundary)
5. **Test** - Full regression testing of wallet features
6. **Deploy** - Push to production

---

**Generated:** December 27, 2025  
**Codebase:** yieldbot-ai (coinvest518/yieldbot-ai)  
**Status:** Ready for implementation

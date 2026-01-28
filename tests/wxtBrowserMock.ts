export const browser = {
  runtime: {
    id: 'test-id',
    lastError: null,
    getURL: jest.fn(path => `chrome-extension://mock${path}`),
    onInstalled: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() },
    sendMessage: jest.fn().mockResolvedValue({})
  },
  storage: {
    sync: {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({}),
      onChanged: { addListener: jest.fn() }
    }
  },
  permissions: {
    contains: jest.fn().mockResolvedValue(true),
    request: jest.fn().mockResolvedValue(true)
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },
  notifications: {
    create: jest.fn()
  },
  tabs: {
    create: jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue({}),
    sendMessage: jest.fn().mockResolvedValue({}),
    onUpdated: { addListener: jest.fn() },
    onActivated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    reload: jest.fn()
  },
  scripting: {
    executeScript: jest.fn().mockResolvedValue([{result: true}]),
    insertCSS: jest.fn().mockResolvedValue(undefined)
  }
};

// Mock chrome global
global.chrome = {
  runtime: {
    getURL: (path) => path,
    lastError: null
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  }
};

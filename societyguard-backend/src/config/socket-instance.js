let ioInstance;

const setIO = (io) => {
  ioInstance = io;
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized. Call setIO first.');
  }
  return ioInstance;
};

module.exports = {
  setIO,
  getIO
};

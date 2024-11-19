// get file type based on the extension
function getFileType(base64String) {
    const extension = base64String.substring(base64String.indexOf('/') + 1, base64String.indexOf(';'));
    switch (extension) {
      case 'jpeg':
      case 'jpg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/png';
    }
  }
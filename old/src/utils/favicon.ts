import screndlyLogo from 'figma:asset/aa914b18f567f6825fda46e6657ced11e5c34887.png';

export function setFavicon() {
  // Set document title
  document.title = 'Screndly';

  // Remove existing favicon if any
  const existingFavicon = document.querySelector("link[rel*='icon']");
  if (existingFavicon) {
    existingFavicon.remove();
  }

  // Create and append new favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = screndlyLogo;
  document.head.appendChild(link);

  // Also set apple-touch-icon for iOS
  const appleTouchIcon = document.createElement('link');
  appleTouchIcon.rel = 'apple-touch-icon';
  appleTouchIcon.href = screndlyLogo;
  document.head.appendChild(appleTouchIcon);
}

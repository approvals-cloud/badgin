import deepMerge from './deepMerge'
import { Value } from './index'
import isPositiveNumber from './isPositiveNumber'

export type Options = {
  backgroundColor: string
  color: string
  indicator: string
}

type Favicon = HTMLLinkElement

type BestFavicon = Favicon | null

// Get all favicons of the page
const getFavicons = (): Favicon[] => {
  const links = document.head.getElementsByTagName('link')
  const favicons: Favicon[] = []

  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const href = link.getAttribute('href')
    const rel = link.getAttribute('rel')

    if (!href) {
      continue
    }

    if (!rel) {
      continue
    }

    if (rel.split(' ').indexOf('icon') === -1) {
      continue
    }

    favicons.push(link)
  }

  return favicons
}

// Get the favicon with the best quality of the document
const getBestFavicon = (): BestFavicon => {
  const favicons = getFavicons()
  let bestFavicon: BestFavicon = null
  let bestSize = 0

  for (let i = 0; i < favicons.length; i++) {
    const favicon = favicons[i]
    const href = favicon.getAttribute('href')
    const rel = favicon.getAttribute('rel')
    const sizes = favicon.getAttribute('sizes')

    if (!href) {
      continue
    }

    if (!rel || rel.split(' ').indexOf('icon') === -1) {
      continue
    }

    // If the link does not have a "sizes" attribute, we use it only if we haven't found anything else yet
    if (!sizes) {
      if (!bestFavicon) {
        bestFavicon = favicon
        bestSize = 0
      }

      continue
    }

    // If we find an icon with sizes "any", it's the best we can get
    if (sizes === 'any') {
      return favicon
    }

    // Otherwise we will try to find the maximum size
    const size = parseInt(sizes.split('x')[0], 10)
    if (Number.isNaN(size)) {
      if (!bestFavicon) {
        bestFavicon = favicon
        bestSize = 0
      }

      continue
    }

    if (size > bestSize) {
      bestFavicon = favicon
      bestSize = size
      continue
    }
  }

  return bestFavicon
}

// Calculate the size of the font and canvas element based on device's ratio
const ratio = Math.ceil(window.devicePixelRatio) || 1
const size = 16 * ratio

// Options
export const defaultOptions: Options = {
  backgroundColor: '#424242',
  color: '#ffffff',
  indicator: '!',
}

// References to the favicons that we need to track in order to reset and update the counters
const current: {
  favicons: Favicon[] | null
  bestFavicon: BestFavicon
  value: Value
  options: Options
} = {
  favicons: null,
  bestFavicon: null,
  value: 0,
  options: defaultOptions,
}

// Setup the source canvas element which we use to generate the favicon's data-url's from
let canvas: HTMLCanvasElement | null = null
let context: CanvasRenderingContext2D | null = null

// Update favicon
const setFavicon = (url: string) => {
  if (!url) {
    return
  }

  // Remove previous favicons
  for (const favicon of getFavicons()) {
    if (favicon.parentNode) {
      favicon.parentNode.removeChild(favicon)
    }
  }

  // Create new favicon
  const newFavicon = document.createElement('link')
  newFavicon.id = 'badgin'
  newFavicon.type = 'image/x-icon'
  newFavicon.rel = 'icon favicon'
  newFavicon.href = url

  document.getElementsByTagName('head')[0].appendChild(newFavicon)
}

// Draw the favicon
const drawFavicon = (value: Value, options: Options) => {
  const image = document.createElement('img')
  image.onload = () => {
    if (!canvas) {
      return
    }

    // Draw image in canvas
    context!.clearRect(0, 0, size, size)
    context!.drawImage(image, 0, 0, image.width, image.height, 0, 0, size, size)

    // Draw bubble over the top
    drawBubble(context!, value, options)

    // Refresh tag in page
    setFavicon(canvas.toDataURL())
  }

  // Load image of best favicon so we can manipulate it
  if (current.bestFavicon) {
    // Allow cross origin resource requests if the image is not a data:uri
    if (!current.bestFavicon.href.match(/^data/)) {
      image.crossOrigin = 'anonymous'
    }

    image.src = current.bestFavicon.href
  }
}

// Draws the bubble on the canvas
const drawBubble = (
  context: CanvasRenderingContext2D,
  value: Value,
  options: Options
) => {
  // Do we need to render the bubble at all?
  let finalValue: string = ''
  if (isPositiveNumber(value)) {
    if (value === 0) {
      finalValue = ''
    } else if (value < 100) {
      finalValue = String(value)
    } else {
      finalValue = '99+'
    }
  } else {
    finalValue = options.indicator
  }

  // Return early
  if (!finalValue) {
    return
  }

  // Calculate position etc.
  const length = finalValue.length - 1
  const width = 8 * ratio + 4 * ratio * length
  const height = 7 * ratio
  const top = size - height
  const left = size - width - ratio
  const bottom = 16 * ratio
  const right = 16 * ratio
  const radius = 5 * ratio

  // Bubble
  context.save()
  context.globalAlpha = 1
  context.fillStyle = options.backgroundColor
  context.strokeStyle = options.backgroundColor
  context.lineWidth = ratio
  context.beginPath()
  context.moveTo(left + radius, top)
  context.quadraticCurveTo(left, top, left, top + radius)
  context.lineTo(left, bottom - radius)
  context.quadraticCurveTo(left, bottom, left + radius, bottom)
  context.lineTo(right - radius, bottom)
  context.quadraticCurveTo(right, bottom, right, bottom - radius)
  context.lineTo(right, top + radius)
  context.quadraticCurveTo(right, top, right - radius, top)
  context.closePath()
  context.fill()
  context.restore()

  // Value
  context.save()
  context.font = `${7 * ratio}px Arial`
  context.fillStyle = options.color
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillText(finalValue, left + width / 2 + 1, 9 * ratio + 1)
  context.restore()
}

export function isAvailable() {
  if (!context) {
    canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    context = canvas.getContext ? canvas.getContext('2d') : null
  }

  return !!context && !!getBestFavicon()
}

export function set(value: Value, options?: Partial<Options>) {
  // Remember options
  current.value = value
  deepMerge(current.options, options || {})

  if (!isAvailable()) {
    return false
  }

  // Remember favicons
  current.bestFavicon = current.bestFavicon || getBestFavicon()
  current.favicons = current.favicons || getFavicons()

  // Draw icon
  drawFavicon(current.value, current.options)
  return true
}

export function clear() {
  if (!isAvailable()) {
    return
  }

  if (current.favicons) {
    // Remove current favicons
    for (const favicon of getFavicons()) {
      if (favicon.parentNode) {
        favicon.parentNode.removeChild(favicon)
      }
    }

    // Recreate old favicons
    for (const favicon of current.favicons) {
      document.head.appendChild(favicon)
    }
    current.favicons = null
    current.bestFavicon = null
  }
}

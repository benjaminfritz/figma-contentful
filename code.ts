const TOOL_ID = '8690d38d-d961-444b-879f-8eab521369a5'
const DISPLAY_NAME = 'Contentful sync'
const CREDS_KEY = `${TOOL_ID}:credentials:v1`

interface Credentials {
  spaceId: string
  environment: string
  locale: string
  pageContentType: string
  apiToken: string
}

figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
figma.showUI(__html__, { width: 360, height: 520, themeColors: true })

pushSelectionState()
figma.on('selectionchange', pushSelectionState)

function pushSelectionState(): void {
  const selection = figma.currentPage.selection
  figma.ui.postMessage({
    type: 'selection-state',
    hasFrame: selection.length === 1 && (selection[0].type === 'FRAME' || selection[0].type === 'SECTION'),
  })
}

interface TextContent {
  name: string
  content: string
  isLarge: boolean
}

interface ContentNode {
  id: string
  instanceName: string
  componentType: string
  texts: TextContent[]
  imageNodeId: string | null
  children: ContentNode[]
}

// "Container/Default" → "container", "InfoCard" → "infoCard"
function getContentTypeId(name: string): string {
  const base = name.split('/')[0].trim()
  return base.charAt(0).toLowerCase() + base.slice(1)
}

function collectDirectTexts(node: SceneNode, texts: TextContent[]): void {
  if (!node.visible) return
  if (node.type === 'TEXT') {
    const t = node as TextNode
    const content = t.characters.trim()
    if (content) {
      texts.push({
        name: node.name,
        content,
        isLarge: typeof t.fontSize === 'number' && (t.fontSize as number) >= 24,
      })
    }
    return
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      if (child.type === 'INSTANCE') continue
      collectDirectTexts(child, texts)
    }
  }
}

function findDirectImage(node: SceneNode): string | null {
  if ('fills' in node) {
    const fills = (node as GeometryMixin).fills
    if (Array.isArray(fills) && fills.some((f) => f.type === 'IMAGE')) return node.id
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      if (child.type === 'INSTANCE') continue
      const found = findDirectImage(child)
      if (found) return found
    }
  }
  return null
}

async function buildTree(node: SceneNode): Promise<ContentNode | null> {
  if (!node.visible || node.type !== 'INSTANCE') return null
  const inst = node as InstanceNode
  const mc = await inst.getMainComponentAsync()

  let componentType: string
  if (mc) {
    const mcParent = mc.parent
    componentType = (mcParent && mcParent.type === 'COMPONENT_SET')
      ? getContentTypeId(mcParent.name)
      : getContentTypeId(mc.name)
  } else {
    componentType = getContentTypeId(inst.name)
  }

  if (componentType === 'icon') return null

  const texts: TextContent[] = []
  collectDirectTexts(inst, texts)
  const imageNodeId = findDirectImage(inst)

  const children: ContentNode[] = []
  for (const child of inst.children) {
    const subtree = await buildTree(child)
    if (subtree) {
      children.push(subtree)
    } else if ('children' in child) {
      const nested = await gatherInstances(child)
      children.push(...nested)
    }
  }

  return { id: inst.id, instanceName: inst.name, componentType, texts, imageNodeId, children }
}

async function gatherInstances(node: SceneNode): Promise<ContentNode[]> {
  if (!node.visible || !('children' in node)) return []
  const results: ContentNode[] = []
  for (const child of (node as ChildrenMixin).children) {
    if (!child.visible) continue
    const tree = await buildTree(child)
    if (tree) {
      results.push(tree)
    } else if ('children' in child) {
      const nested = await gatherInstances(child)
      results.push(...nested)
    }
  }
  return results
}

async function analyzeFrame(frame: SceneNode): Promise<ContentNode[]> {
  return gatherInstances(frame)
}

type IncomingMsg =
  | { type: 'ui-ready' }
  | { type: 'resize'; height: number }
  | { type: 'save-credentials'; creds: Credentials }
  | { type: 'analyze' }
  | { type: 'export-image'; nodeId: string }
  | { type: 'notify'; text: string; options?: { error?: boolean } }

figma.ui.onmessage = async (msg: IncomingMsg) => {
  if (msg.type === 'ui-ready') {
    const creds = await figma.clientStorage.getAsync(CREDS_KEY) as Credentials | undefined
    if (creds) figma.ui.postMessage({ type: 'restore-credentials', creds })
    pushSelectionState()
    return
  }
  if (msg.type === 'resize') {
    figma.ui.resize(360, Math.max(200, Math.min(900, Math.round(msg.height))))
    return
  }
  if (msg.type === 'save-credentials') {
    await figma.clientStorage.setAsync(CREDS_KEY, msg.creds)
    figma.ui.postMessage({ type: 'credentials-saved' })
    return
  }
  if (msg.type === 'analyze') {
    const sel = figma.currentPage.selection
    if (sel.length !== 1 || (sel[0].type !== 'FRAME' && sel[0].type !== 'SECTION')) {
      figma.notify('Select a single frame or section to analyze')
      return
    }
    const frame = sel[0]
    const trees = await analyzeFrame(frame)
    figma.ui.postMessage({ type: 'analysis-result', frameName: frame.name, frameId: frame.id, trees })
    return
  }
  if (msg.type === 'export-image') {
    const node = await figma.getNodeByIdAsync(msg.nodeId)
    if (!node || !('exportAsync' in node)) {
      figma.ui.postMessage({ type: 'image-exported', nodeId: msg.nodeId, bytes: null })
      return
    }
    try {
      const bytes = await (node as ExportMixin).exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 1 },
      })
      figma.ui.postMessage({ type: 'image-exported', nodeId: msg.nodeId, bytes })
    } catch {
      figma.ui.postMessage({ type: 'image-exported', nodeId: msg.nodeId, bytes: null })
    }
    return
  }
  if (msg.type === 'notify') {
    figma.notify(msg.text, msg.options)
    return
  }
}

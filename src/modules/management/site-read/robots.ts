export const AGENT_NAME = 'happytohelp-site-reader'
export const USER_AGENT = `HappyToHelp-Site-Reader/1.0 (+https://happytohelp.com; reads your public help pages once after setup; honours robots.txt)`

export type Robots = (pathAndQuery: string) => boolean

interface Rule {allow: boolean; pattern: RegExp; length: number}

const rulePattern = (path: string) => new RegExp('^' + path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))

/** robots.txt as a predicate. The group naming this reader wins over `*`; the longest matching rule wins and allow wins a tie. */
export function parseRobots(text: string): Robots {
 const groups: {agents: string[]; rules: Rule[]}[] = []
 let open = false
 for (const raw of text.split(/\r?\n/)) {
  const line = raw.replace(/#.*/, '').trim()
  const split = line.indexOf(':')
  if (split < 1) continue
  const field = line.slice(0, split).trim().toLowerCase(), value = line.slice(split + 1).trim()
  if (field === 'user-agent') {
   if (!open) groups.push({agents: [], rules: []})
   groups[groups.length - 1].agents.push(value.toLowerCase())
   open = true
  } else if ((field === 'allow' || field === 'disallow') && groups.length) {
   open = false
   if (value) groups[groups.length - 1].rules.push({allow: field === 'allow', pattern: rulePattern(value), length: value.length})
  } else open = false
 }
 const own = groups.filter(group => group.agents.some(agent => agent && agent !== '*' && AGENT_NAME.includes(agent)))
 const chosen = (own.length ? own : groups.filter(group => group.agents.includes('*'))).flatMap(group => group.rules)
 return path => {
  let best: Rule | undefined
  for (const rule of chosen) {
   if (!rule.pattern.test(path)) continue
   if (!best || rule.length > best.length || rule.length === best.length && rule.allow) best = rule
  }
  return best ? best.allow : true
 }
}

export const allowAll: Robots = () => true

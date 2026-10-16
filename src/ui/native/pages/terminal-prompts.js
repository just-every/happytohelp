// Shell lines for the scripts pages ask people to paste into Terminal. Each works the same in macOS's default zsh
// and in bash, interactive or not. Questions are plain text without quotes, so they sit safely inside '...'.

/** Ask for a value and keep what is typed. */
export const prompt = (variable, question) => `printf '${question}: '; read -r ${variable}`;

/** Ask for a secret without showing it: echo is off while it is typed and back on afterwards, even after Control-C. */
export const secret = (variable, question) => `printf '${question} (not shown as you type): '; trap 'stty echo' EXIT; stty -echo; read -r ${variable}; stty echo; echo`;

/** Stop before anything is requested when an answer was left empty. */
export const required = (...variables) => `[ -n "${variables.map(variable => `$${variable}`).join('" ] && [ -n "')}" ] || { echo 'An answer was left empty, so nothing was fetched. Paste the script again.'; exit 1; }`;

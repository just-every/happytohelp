import assert from 'node:assert/strict';

export async function assertLauncherAvatarFits(launcher) {
    const geometry = await launcher.evaluate(button => {
        const rect = element => {const r = element.getBoundingClientRect(); return {top: r.top, bottom: r.bottom, left: r.left, right: r.right};};
        const avatar = button.querySelector('.happytohelp-agent-avatar, .happytohelp-ai-avatar');
        const style = getComputedStyle(button);
        return {button: rect(button), avatar: avatar && rect(avatar), images: [...(avatar?.querySelectorAll('img') || [])].map(rect),
            overflow: style.overflow, radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius]};
    });
    assert.ok(geometry.avatar, 'closed launcher contains the real responder avatar');
    for (const bounds of [geometry.avatar, ...geometry.images]) {
        for (const edge of ['top', 'bottom', 'left', 'right']) {
            assert.ok(Math.abs(bounds[edge] - geometry.button[edge]) < 0.5, `avatar ${edge} fills button within half a pixel: ${JSON.stringify(geometry)}`);
        }
    }
    assert.equal(geometry.overflow, 'hidden', 'launcher clips the avatar to its rounded boundary');
    assert.deepEqual(geometry.radii, ['50%', '50%', '50%', '50%'], 'all four launcher corners form a round clip');
    return geometry;
}

module.exports = {
  makeMutable: (val) => ({ value: val }),
  useSharedValue: (val) => ({ value: val }),
  useAnimatedStyle: (fn) => fn(),
  withTiming: (toValue) => toValue,
  withSpring: (toValue) => toValue,
  withRepeat: (anim) => anim,
  withSequence: (...anims) => anims[0],
  withDelay: (_, anim) => anim,
  Easing: {
    linear: (t) => t,
    ease: (t) => t,
    bezier: () => (t) => t,
    in: () => (t) => t,
    out: () => (t) => t,
    inOut: () => (t) => t,
  },
  default: {},
};

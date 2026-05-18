const OPPONENT_ARCHETYPE_MAP = new Map([
  ["cycle", "fast_cycle"],
  ["fast cycle", "fast_cycle"],
  ["hog cycle", "fast_cycle"],
  ["drill cycle", "fast_cycle"],
  ["xbow cycle", "fast_cycle"],
  ["x-bow cycle", "fast_cycle"],
  ["beatdown", "beatdown"],
  ["air beatdown", "air_beatdown"],
  ["air_beatdown", "air_beatdown"],
  ["lavaloon", "air_beatdown"],
  ["lava loon", "air_beatdown"],
  ["lava", "air_beatdown"],
  ["log bait", "log_bait"],
  ["log_bait", "log_bait"],
  ["classic log bait", "log_bait"],
  ["hyper bait", "hyper_bait"],
  ["hyper_bait", "hyper_bait"],
  ["spam bait", "hyper_bait"],
  ["bridge spam", "bridge_spam"],
  ["bridge_spam", "bridge_spam"],
  ["bridgespam", "bridge_spam"],
  ["control", "control_counterpush"],
  ["control/counter-push", "control_counterpush"],
  ["counterpush", "control_counterpush"],
  ["counter push", "control_counterpush"],
  ["splashyard", "control_counterpush"],
  ["miner poison", "control_counterpush"],
  ["siege", "siege"],
  ["split lane", "split_lane_pressure"],
  ["split-lane", "split_lane_pressure"],
  ["split_lane_pressure", "split_lane_pressure"],
  ["recruits hogs", "split_lane_pressure"],
  ["3m", "split_lane_pressure"],
  ["three musketeers", "split_lane_pressure"],
  ["no wincon", "midladder_no_wincon"],
  ["no win condition", "midladder_no_wincon"],
  ["quad tank", "midladder_overcommit"],
  ["overcommit", "midladder_overcommit"],
  ["spell turtle", "midladder_spell_turtle"],
  ["pocket rocket", "midladder_spell_turtle"],
  ["freeze trap", "midladder_freeze_trap"],
  ["meta hodgepodge", "midladder_meta_hodgepodge"],
  ["top deck copier", "midladder_meta_hodgepodge"],
  ["bait", "log_bait"],
  ["spell bait", "log_bait"],
  ["offmeta", "custom_offmeta"],
  ["custom", "custom_offmeta"],
  ["custom_offmeta", "custom_offmeta"],
]);

function normalizeArchetypeInput(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, " ").replace(/[^\w\s-]/g, "");
  if (OPPONENT_ARCHETYPE_MAP.has(compact)) return OPPONENT_ARCHETYPE_MAP.get(compact);
  const underscored = compact.replace(/\s+/g, "_");
  if (OPPONENT_ARCHETYPE_MAP.has(underscored)) return OPPONENT_ARCHETYPE_MAP.get(underscored);
  return "custom_offmeta";
}

module.exports = {
  normalizeArchetypeInput,
};

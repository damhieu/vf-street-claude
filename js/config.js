// Mọi hằng số chỉnh được của game. Đơn vị: mét, giây, m/s trừ khi ghi khác.
export const CFG = {
  STEP: 1 / 60,
  MAX_STEPS_PER_FRAME: 5,
  G: 9.81,
  RHO_AIR: 1.2,
  RENDER: {
    W: 960,
    H: 540,
    SEG_LEN: 4,
    DRAW_SEGS: 150,
    CAM_H: 2.4,
    FOV_DEG: 100,
    PLAYER_AHEAD: 3.6,
    KAPPA_RENDER_MAX: 1 / 25,
    PLAYER_SCALE: 1.05,
  },
  PHYS: {
    ETA_DRIVE: 0.95,
    TORQUE_BASE_KMH: 45,
    ROT_INERTIA: 1.04,
    COAST_G: 0.08,
    BRAKE_G_CAP: 1.05,
    KAPPA_MAX: 1 / 12,
    R_MIN_STEER_DEG: 35,
    STEER_OVER: 1.5, // vô lăng có thể đòi hỏi tới 1,5·μg → quá giới hạn là lốp trượt
    MU_SLIDE: 0.85, // bám giảm khi đang trượt
    TAU_RESP_BASE: 0.3, // trễ đáp ứng ngang (s) cho xe 1,2 tấn
    TAU_RESP_PER_TONNE: 0.1,
    TAU_DAMP: 0.5, // giảm chấn vận tốc ngang (lái tự trả)
    SLIDE_T: 0.4,
    SLIDE_THRESHOLD: 1.0,
    SCRUB: 0.6,
    STEER_GAIN_SLIDE: 0.4,
    OFFROAD_EXTRA_DECEL: 3,
    OFFROAD_EXTRA_FROM_KMH: 60,
    BARRIER_STUN: 1.0,
    BARRIER_KEEP_SHALLOW: 0.6,
    BARRIER_KEEP_HARD: 0.25,
    BARRIER_HARD_VLAT: 3,
    MU: {
      asphalt: { mu: 0.95, crr: 0.011 },
      rough: { mu: 0.88, crr: 0.03 },
      concrete: { mu: 0.92, crr: 0.012 },
      gravel: { mu: 0.65, crr: 0.04 },
      grass: { mu: 0.55, crr: 0.08 },
    },
  },
  INPUT: { STEER_UP: 0.35, STEER_DOWN: 0.25 },
  AI: {
    HZ: 10,
    REACTION: 0.15,
    CORNER_FRAC: [0.88, 0.94], // vào cua ở 77–88 % giới hạn ngang để còn dư bám sửa quỹ đạo
    BRAKE_FRAC: [0.85, 1.0],
    AGGRESSION: [0.6, 0.9],
    BLOCK_DIST: 25,
    BLOCK_RATE: 1.5,
    BLOCK_COOLDOWN: 2,
    LOOKAHEAD_EXTRA: 40,
    GAP_TIME: 1.4,
    OVERTAKE_DV_KMH: 15,
    CORNER_NOISE: 0.03,
    KP: 2.0,
    KD: 2.5,
    BRAKE_PLAN: 0.8, // kế hoạch phanh dùng 80 % bám dọc để còn bám ngang lúc vào cua
    LATERAL_USE: 0.97, // AI đòi tối đa 97 % bám ngang còn lại
    BRAKE_GAIN: 0.6,
    BRAKE_MIN: 0.35,
    LAUNCH_DELAY: [0.2, 0.5],
  },
  FIELD: { AI_COUNT: 5, AI_COUNT_MOTORWAY: 7, GRID_GAP: 8, GRID_X: 1.6 },
  COLLISION: { RESTITUTION: 0.2, SIDE_PUSH: 1.2, SIDE_LOSS: 0.03, CAR_STUN: 0.6, BIKE_STUN: 1.0, BIKE_TARGET_KMH: 30, BIKE_BRAKE_T: 4.0 }, // ép phanh tới khi ≤ BIKE_TARGET_KMH, tối đa 4 s
  TRAFFIC: { WINDOW_BACK: 100, WINDOW_AHEAD: 700, ONCOMING_AHEAD: 900, MIN_SPAWN_AHEAD: 250, MIN_GAP: 60 },
  RACE: { COUNTDOWN: 3.2, LAPS: 3, FINISH_HOLD: 2.5, SECTORS: 3 },
};

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::time::Instant;

pub struct SpeedGovernor {
    limit_bps: AtomicU64,
    tokens: AtomicU64,
    last_refill: Mutex<Instant>,
}

impl SpeedGovernor {
    pub fn new(limit_bps: u64) -> Arc<Self> {
        let capacity = if limit_bps == 0 { u64::MAX } else { limit_bps };
        Arc::new(Self {
            limit_bps: AtomicU64::new(limit_bps),
            tokens: AtomicU64::new(capacity),
            last_refill: Mutex::new(Instant::now()),
        })
    }

    pub fn set_limit(&self, bps: u64) {
        self.limit_bps.store(bps, Ordering::Relaxed);
        if bps == 0 {
            self.tokens.store(u64::MAX, Ordering::Relaxed);
        }
    }

    pub async fn acquire(&self, bytes: u64) {
        let limit = self.limit_bps.load(Ordering::Relaxed);
        if limit == 0 {
            return;
        }

        loop {
            {
                let mut last = self.last_refill.lock().await;
                let now = Instant::now();
                let elapsed = now.duration_since(*last).as_secs_f64();
                if elapsed > 0.001 {
                    let refill = (limit as f64 * elapsed) as u64;
                    let current = self.tokens.load(Ordering::Relaxed);
                    let new_tokens = current.saturating_add(refill).min(limit);
                    self.tokens.store(new_tokens, Ordering::Relaxed);
                    *last = now;
                }
            }

            let current = self.tokens.load(Ordering::Relaxed);
            if current >= bytes {
                self.tokens.fetch_sub(bytes, Ordering::Relaxed);
                return;
            }

            let deficit = bytes - current;
            let limit_now = self.limit_bps.load(Ordering::Relaxed);
            if limit_now == 0 {
                return;
            }
            let wait_secs = deficit as f64 / limit_now as f64;
            let wait_ms = (wait_secs * 1000.0).ceil().max(5.0) as u64;
            tokio::time::sleep(tokio::time::Duration::from_millis(wait_ms)).await;
        }
    }
}

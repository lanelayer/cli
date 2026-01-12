/// Trait for handling health check results deterministically
/// This replaces the channel-based approach to avoid non-determinism
pub trait HealthCheckHandler: Send + Sync {
    /// Called when a health check succeeds
    fn on_health_check_success(&mut self);

    /// Called when a health check fails
    fn on_health_check_failure(&mut self);

    /// Check if we should proceed (e.g., health check succeeded)
    fn should_proceed(&self) -> bool;

    /// Check if health check has failed
    fn has_failed(&self) -> bool;

    /// Reset the handler state
    fn reset(&mut self);
}

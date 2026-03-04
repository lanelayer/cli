#!/bin/sh
ip link set lo up
ip addr
socat VSOCK-LISTEN:8080,fork TCP:127.0.0.1:8080 &
socat VSOCK-LISTEN:8022,fork TCP:127.0.0.1:22 &
socat TCP-LISTEN:10000,fork VSOCK-CONNECT:1:10000 &
tail -F /var/log/app.log /var/log/app.out.log >> /dev/console &
echo "CMIO guest agent setting: $CMIO_GUEST_AGENT" >> /dev/console
echo "Waiting for healthcheck on TCP 8080..." >> /dev/console
while ! curl -sSf --connect-timeout 2 -o /dev/null http://127.0.0.1:8080/health 2>/dev/null; do
	echo "Healthcheck failed, retrying..." >> /dev/console
	sleep 1
done
echo "Healthcheck passed, starting guest agent" >> /dev/console
#if [ x$CMIO_GUEST_AGENT != x ]; then
	if [ "x$DEBUG_GUEST_AGENT" != "x" ]; then
		echo "Starting guest agent (debug enabled)" >> /dev/console
        	RUST_LOG=${RUST_LOG:-trace} /bin/guest-agent >> /dev/console 2>&1
	else
		echo "Starting guest agent" >> /dev/console
        	/bin/guest-agent >> /dev/console 2>&1
	fi
#fi
echo "Guest agent failed to start" >> /dev/console
while true; do
        sleep 99999
done

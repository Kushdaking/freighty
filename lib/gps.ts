import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

const TRACKING_TASK = 'FREIGHT_FLOW_LOCATION_TASK';
let activeShipmentId: string | null = null;

// Background task — runs even when app is minimized
TaskManager.defineTask(TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('GPS task error:', error);
    return;
  }

  if (!data?.locations?.length || !activeShipmentId) return;

  const loc = data.locations[0];
  const { latitude, longitude, speed, heading, altitude } = loc.coords;

  try {
    // Update shipment current location
    await supabase
      .from('shipments')
      .update({
        current_lat: latitude,
        current_lng: longitude,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', activeShipmentId);

    // Log to GPS tracking history
    await supabase.from('gps_tracking_history').insert({
      shipment_id: activeShipmentId,
      lat: latitude,
      lng: longitude,
      speed: speed ?? null,
      bearing: heading ?? null,
      altitude: altitude ?? null,
      recorded_at: new Date(loc.timestamp).toISOString(),
    });
  } catch (err) {
    console.error('Failed to save GPS location:', err);
  }
});

export async function startTracking(shipmentId: string): Promise<boolean> {
  try {
    // Request foreground permission first
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return false;

    // Request background permission
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') return false;

    activeShipmentId = shipmentId;

    // Stop any existing tracking
    const isRunning = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(TRACKING_TASK);
    }

    // Start background location updates
    await Location.startLocationUpdatesAsync(TRACKING_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 50,          // Update every 50 meters
      timeInterval: 30000,            // Or every 30 seconds
      deferredUpdatesInterval: 30000,
      deferredUpdatesDistance: 50,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Freight Flow — Tracking Active',
        notificationBody: 'Your location is being shared with the dispatcher.',
        notificationColor: '#2563eb',
      },
    });

    return true;
  } catch (err) {
    console.error('Failed to start GPS tracking:', err);
    return false;
  }
}

export async function stopTracking(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(TRACKING_TASK);
    }
    activeShipmentId = null;
  } catch (err) {
    console.error('Failed to stop GPS tracking:', err);
  }
}

export async function isTracking(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK);
  } catch {
    return false;
  }
}

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  return await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
}

export function setActiveShipment(id: string | null) {
  activeShipmentId = id;
}

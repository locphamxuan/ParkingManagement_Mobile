import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Colors, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import { guessVehicleCategory } from '../../utils/vehicle';
import { GlitterParticle } from './animations';
import type { ReservationsVM } from '../../hooks/useReservations';

// Step 1 wizard — chọn toà, gói dài hạn, biển số, loại xe.
export function WizardStep1({ vm }: { vm: ReservationsVM }) {
  const {
    plates,
    wizard, setWizard,
    bookingType,
    selectedPackageId, setSelectedPackageId,
    packages, fetchingPackages,
    particles, triggerGlitter,
    buildings, fetchingBuildings, handleSelectBuilding,
    vehicleTypes, fetchingVT,
    vtCategory, eligiblePlates,
  } = vm;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
      <View style={{ gap: Spacing.md, paddingBottom: Spacing.lg }}>

        {/* Building selector */}
        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>Select Building</Text>
          {fetchingBuildings ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : buildings.length === 0 ? (
            <Text style={styles.hintText}>No buildings available.</Text>
          ) : (
            buildings.map((b) => {
              const addrStr = typeof b.address === 'string'
                ? b.address
                : (b.address as any)?.fullAddress ?? null;
              return (
                <TouchableOpacity
                  key={b._id}
                  style={[styles.buildingCard, wizard.buildingId === b._id && styles.buildingCardActive]}
                  onPress={() => handleSelectBuilding(b._id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.buildingName, wizard.buildingId === b._id && { color: Colors.primary }]}>
                      {b.name}
                    </Text>
                    {addrStr ? (
                      <Text style={styles.buildingAddr}>{addrStr}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.buildingCode}>{b.code}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Package Selector */}
        {bookingType === 'package' && !!wizard.buildingId && (
          <View style={{ gap: Spacing.xs }}>
            <Text style={styles.fieldLabel}>Select Subscription Package</Text>
            {fetchingPackages ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : packages.length === 0 ? (
              <Text style={styles.hintText}>No packages available for this building.</Text>
            ) : (
              <View style={{ gap: Spacing.sm }}>
                {packages.filter((pkg) => {
                  const pkgVtId = typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType._id : pkg.vehicleType;
                  return pkgVtId === wizard.vehicleTypeId;
                }).map((pkg) => {
                  const isSelected = selectedPackageId === pkg._id;
                  return (
                    <TouchableOpacity
                      key={pkg._id}
                      style={[styles.pkgSelectCard, isSelected && styles.pkgSelectCardActive]}
                      onPress={() => {
                        setSelectedPackageId(pkg._id);
                        triggerGlitter();
                      }}
                    >
                      {isSelected && particles.map((p) => (
                        <GlitterParticle key={p.id} color={p.color} size={p.size} />
                      ))}
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.pkgSelectName, isSelected && { color: Colors.primary }]}>{pkg.name}</Text>
                        <Text style={styles.pkgSelectDuration}>{pkg.durationDays} Days</Text>
                      </View>
                      <Text style={styles.pkgSelectPrice}>{(pkg.price).toLocaleString('en-US')} VND</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Dedicated Slot option removed from Step 1 */}

        {/* License plate selector — filtered by vehicle type category */}
        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>
            License Plate
            {vtCategory ? (
              <Text style={{ color: Colors.textDim }}>
                {' '}({vtCategory === 'motorcycle' ? 'Motorcycle only' : 'Car only'})
              </Text>
            ) : null}
          </Text>
          {eligiblePlates.length > 0 ? (
            <View style={styles.chipRow}>
              {eligiblePlates.map((p) => {
                const isCar = p.vehicleType === 'car';
                const emoji = isCar ? '🚗' : '🏍️';
                return (
                  <TouchableOpacity
                    key={p.plateNumber}
                    style={[styles.chip, wizard.plateNumber === p.plateNumber && styles.chipActive]}
                    onPress={() => setWizard((prev) => ({ ...prev, plateNumber: p.plateNumber }))}
                  >
                    <Text style={[styles.chipText, wizard.plateNumber === p.plateNumber && styles.chipTextActive]}>
                      {emoji} {p.plateNumber}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : vtCategory && plates.length > 0 ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                You have no {vtCategory === 'motorcycle' ? 'motorcycle' : 'car'} plates saved. Add one in Profile first.
              </Text>
            </View>
          ) : (
            <TextInput
              value={wizard.plateNumber}
              onChangeText={(t) => setWizard((p) => ({ ...p, plateNumber: t.toUpperCase() }))}
              placeholder="e.g. 29A-12345"
              placeholderTextColor={Colors.textDim}
              style={styles.textInput}
              autoCapitalize="characters"
            />
          )}
        </View>

        {/* Vehicle type selector */}
        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>
            Vehicle Type
            {fetchingVT ? <Text style={{ color: Colors.textDim }}> (loading...)</Text> : null}
          </Text>
          {fetchingVT ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : vehicleTypes.length > 0 ? (
            <View style={styles.chipRow}>
              {vehicleTypes.map((vt) => (
                <TouchableOpacity
                  key={vt._id}
                  style={[styles.chip, wizard.vehicleTypeId === vt._id && styles.chipActive]}
                  onPress={() => {
                    const cat = guessVehicleCategory(vt.name);
                    const matchPlate = cat ? plates.find((p) => p.vehicleType === cat) : plates[0];
                    setWizard((prev) => ({
                      ...prev,
                      vehicleTypeId: vt._id,
                      plateNumber: matchPlate?.plateNumber ?? '',
                    }));
                  }}
                >
                  <Text style={[styles.chipText, wizard.vehicleTypeId === vt._id && styles.chipTextActive]}>
                    {vt.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : wizard.buildingId ? (
            <Text style={styles.hintText}>No vehicle types for this building.</Text>
          ) : (
            <Text style={styles.hintText}>Select a building to load vehicle types.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

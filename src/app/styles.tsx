import { StyleSheet } from 'react-native';

const BLUE  = '#4da8da';
const BG    = '#0d1f2d';
const CARD  = '#132333';
const MUTED = '#556677';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a3a50',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  backBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  backBtnText: { color: BLUE, fontSize: 15, fontWeight: '600' },
  sectionsGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionCard: {
    width: '47%',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 110,
    justifyContent: 'center',
  },
  sectionIcon: { fontSize: 32, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  sectionCount: { color: MUTED, fontSize: 12 },
  list: { padding: 16 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1a3a50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'right', flex: 1 },
  cardArrow: { fontSize: 18, marginLeft: 10 },
  modalContainer: { flex: 1, backgroundColor: BG },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a3a50',
  },
  modalHeaderTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  modalContent: { padding: 24, paddingBottom: 60 },
  bismillah: { color: '#c9a84c', fontSize: 18, textAlign: 'center', marginBottom: 20, lineHeight: 32 },
  modalText: { color: '#ddeeff', fontSize: 20, lineHeight: 40, textAlign: 'right', marginBottom: 30 },
  sourceBox: { backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1a3a50' },
  modalSource: { color: MUTED, fontSize: 14, textAlign: 'center' },
});
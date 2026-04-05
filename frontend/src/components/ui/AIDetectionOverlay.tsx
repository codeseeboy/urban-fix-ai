import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, Animated, Dimensions, Image,
    Easing, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface AIResult {
    is_valid?: boolean;
    category?: string;
    main_issue?: string;
    ai_severity?: string;
    issue_count?: number;
    category_confidence?: number;
    ai_tags?: string[];
    note?: string;
}

interface Props {
    visible: boolean;
    images: string[];
    onAnalyzeImage: (uri: string) => Promise<AIResult>;
    onComplete: (results: AIResult[]) => void;
    onRejected: (reason: string) => void;
}

const PHASES = [
    { key: 'scanning', label: 'Scanning Image…', emoji: '🔍', color: '#5AC8FA', dur: 2200 },
    { key: 'analyzing', label: 'AI Analyzing…', emoji: '🧠', color: '#BF5AF2', dur: 2000 },
    { key: 'identifying', label: 'Identifying Issues…', emoji: '🎯', color: '#FFD60A', dur: 1800 },
];

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function ScanLine({ active }: { active: boolean }) {
    const pos = useRef(new Animated.Value(0)).current;
    const op = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (active) {
            op.setValue(1);
            Animated.loop(Animated.sequence([
                Animated.timing(pos, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pos, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])).start();
        } else { op.setValue(0); pos.stopAnimation(); }
    }, [active]);
    return (
        <Animated.View style={[styles.scanLine, {
            opacity: op,
            transform: [{ translateY: pos.interpolate({ inputRange: [0, 1], outputRange: [-20, SCREEN_W * 0.72] }) }],
        }]} />
    );
}

function DetectionBox({ phase, index }: { phase: string; index: number }) {
    const appear = useRef(new Animated.Value(0)).current;
    const boxes = [
        { top: '18%', left: '12%', w: 120, h: 80 },
        { top: '45%', left: '50%', w: 100, h: 70 },
        { top: '60%', left: '20%', w: 90, h: 60 },
    ];
    const b = boxes[index % boxes.length];
    useEffect(() => {
        if (phase === 'analyzing' || phase === 'identifying') {
            Animated.sequence([
                Animated.delay(index * 350),
                Animated.spring(appear, { toValue: 1, stiffness: 200, damping: 15, useNativeDriver: true }),
            ]).start();
        } else { appear.setValue(0); }
    }, [phase]);
    const bc = phase === 'identifying' ? '#FFD60A' : '#5AC8FA';
    return (
        <Animated.View style={{
            position: 'absolute', top: b.top as any, left: b.left as any,
            width: b.w, height: b.h, borderWidth: 1.5, borderColor: bc,
            borderRadius: 6, opacity: appear, transform: [{ scale: appear }],
        }}>
            <View style={[styles.corner, styles.cTL, { borderColor: bc }]} />
            <View style={[styles.corner, styles.cTR, { borderColor: bc }]} />
            <View style={[styles.corner, styles.cBL, { borderColor: bc }]} />
            <View style={[styles.corner, styles.cBR, { borderColor: bc }]} />
        </Animated.View>
    );
}

export default function AIDetectionOverlay({ visible, images, onAnalyzeImage, onComplete, onRejected }: Props) {
    const [idx, setIdx] = useState(0);
    const [phase, setPhase] = useState('scanning');
    const [result, setResult] = useState<AIResult | null>(null);
    const [allResults, setAllResults] = useState<AIResult[]>([]);
    const allResultsRef = useRef<AIResult[]>([]);

    const bgOp = useRef(new Animated.Value(0)).current;
    const imgScale = useRef(new Animated.Value(0.8)).current;
    const imgOp = useRef(new Animated.Value(0)).current;
    const txtOp = useRef(new Animated.Value(0)).current;
    const txtY = useRef(new Animated.Value(20)).current;
    const cardY = useRef(new Animated.Value(100)).current;
    const cardOp = useRef(new Animated.Value(0)).current;
    const checkScale = useRef(new Animated.Value(0)).current;
    const rejectScale = useRef(new Animated.Value(0)).current;
    const glow = useRef(new Animated.Value(0)).current;
    const crosshair = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setIdx(0); setPhase('scanning'); setResult(null); setAllResults([]);
            allResultsRef.current = [];
            bgOp.setValue(0); imgScale.setValue(0.8); imgOp.setValue(0);
            Animated.parallel([
                Animated.timing(bgOp, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(imgScale, { toValue: 1, stiffness: 150, damping: 16, useNativeDriver: true }),
                Animated.timing(imgOp, { toValue: 1, duration: 500, useNativeDriver: true }),
            ]).start();
            Animated.loop(Animated.sequence([
                Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])).start();
        } else { bgOp.setValue(0); }
    }, [visible]);

    useEffect(() => {
        if (!visible || idx >= images.length) return;
        runForImage(idx);
    }, [idx, visible]);

    const animTxt = () => {
        txtOp.setValue(0); txtY.setValue(20);
        Animated.parallel([
            Animated.timing(txtOp, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(txtY, { toValue: 0, stiffness: 200, damping: 18, useNativeDriver: true }),
        ]).start();
    };

    const runForImage = useCallback(async (i: number) => {
        const uri = images[i]; if (!uri) return;
        checkScale.setValue(0); rejectScale.setValue(0);
        cardY.setValue(100); cardOp.setValue(0); crosshair.setValue(0);

        setPhase('scanning'); animTxt();
        const prom = onAnalyzeImage(uri);

        await wait(PHASES[0].dur);
        setPhase('analyzing'); animTxt();

        await wait(PHASES[1].dur);
        setPhase('identifying'); animTxt();
        Animated.spring(crosshair, { toValue: 1, stiffness: 200, damping: 12, useNativeDriver: true }).start();

        let res: AIResult;
        try { res = await prom; } catch (e: any) { res = { is_valid: false, note: e?.message || 'AI analysis failed' }; }
        await wait(800);
        setResult(res);

        if (res.is_valid === false) {
            setPhase('rejected'); animTxt();
            Animated.spring(rejectScale, { toValue: 1, stiffness: 200, damping: 10, useNativeDriver: true }).start();
            Animated.parallel([
                Animated.spring(cardY, { toValue: 0, stiffness: 150, damping: 16, useNativeDriver: true }),
                Animated.timing(cardOp, { toValue: 1, duration: 300, useNativeDriver: true }),
            ]).start();
            await wait(2000);
            Animated.timing(bgOp, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
                onRejected(res.note || 'Image does not show a valid civic issue.');
            });
            return;
        }

        setPhase('identified'); animTxt();
        Animated.spring(checkScale, { toValue: 1, stiffness: 250, damping: 10, useNativeDriver: true }).start();
        Animated.parallel([
            Animated.spring(cardY, { toValue: 0, stiffness: 150, damping: 16, useNativeDriver: true }),
            Animated.timing(cardOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();

        // Use ref to avoid stale closure — always has latest accumulated results
        const updated = [...allResultsRef.current, res];
        allResultsRef.current = updated;
        setAllResults(updated);
        await wait(2200);

        if (i + 1 < images.length) {
            Animated.parallel([
                Animated.timing(imgOp, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(cardOp, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start(() => {
                setResult(null); imgOp.setValue(0); imgScale.setValue(0.85);
                Animated.parallel([
                    Animated.spring(imgScale, { toValue: 1, stiffness: 150, damping: 16, useNativeDriver: true }),
                    Animated.timing(imgOp, { toValue: 1, duration: 400, useNativeDriver: true }),
                ]).start();
                setIdx(i + 1);
            });
        } else {
            await wait(400);
            Animated.timing(bgOp, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
                onComplete(updated);
            });
        }
    }, [images, onAnalyzeImage, onComplete, onRejected]);

    if (!visible) return null;

    const pc = PHASES.find(p => p.key === phase);
    const phaseLabel = phase === 'identified' ? '✅ Issue Identified!'
        : phase === 'rejected' ? '❌ Image Rejected'
        : pc ? `${pc.emoji} ${pc.label}` : '';
    const phaseColor = phase === 'identified' ? '#30D158'
        : phase === 'rejected' ? '#FF453A'
        : pc?.color || '#5AC8FA';

    return (
        <Animated.View style={[styles.overlay, { opacity: bgOp }]}>
            <View style={styles.grid}>
                {Array.from({ length: 12 }).map((_, i) => (
                    <View key={`h${i}`} style={[styles.gridH, { top: `${(i+1)*8}%` }]} />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                    <View key={`v${i}`} style={[styles.gridV, { left: `${(i+1)*12.5}%` }]} />
                ))}
            </View>

            {images.length > 1 && (
                <View style={styles.multiProg}>
                    <Text style={styles.multiText} allowFontScaling={false}>
                        Analyzing {idx + 1} of {images.length}
                    </Text>
                    <View style={styles.multiDots}>
                        {images.map((_, i) => (
                            <View key={i} style={[styles.dot,
                                i < idx && styles.dotDone,
                                i === idx && styles.dotActive,
                            ]} />
                        ))}
                    </View>
                </View>
            )}

            <Animated.View style={[styles.imgWrap, { transform: [{ scale: imgScale }], opacity: imgOp }]}>
                <Animated.View style={[styles.glowRing, { borderColor: phaseColor, opacity: glow.interpolate({ inputRange: [0,1], outputRange: [0.3, 0.8] }) }]} />
                <Image source={{ uri: images[idx] }} style={styles.img} resizeMode="cover" />
                <ScanLine active={phase === 'scanning'} />
                {(phase === 'analyzing' || phase === 'identifying') && [0,1,2].map(i => <DetectionBox key={i} phase={phase} index={i} />)}
                {phase === 'identifying' && (
                    <Animated.View style={[styles.xhairWrap, { transform: [{ scale: crosshair }] }]}>
                        <View style={[styles.xhairLine, { width: 60, height: 1.5 }]} />
                        <View style={[styles.xhairLine, { width: 1.5, height: 60, position: 'absolute' }]} />
                        <View style={styles.xhairDot} />
                    </Animated.View>
                )}
                {phase === 'identified' && (
                    <Animated.View style={[styles.burst, { transform: [{ scale: checkScale }] }]}>
                        <View style={[styles.burstCircle, { backgroundColor: '#30D158' }]}>
                            <Ionicons name="checkmark" size={40} color="#FFF" />
                        </View>
                    </Animated.View>
                )}
                {phase === 'rejected' && (
                    <Animated.View style={[styles.burst, { transform: [{ scale: rejectScale }] }]}>
                        <View style={[styles.burstCircle, { backgroundColor: '#FF453A' }]}>
                            <Ionicons name="close" size={40} color="#FFF" />
                        </View>
                    </Animated.View>
                )}
            </Animated.View>

            <Animated.View style={[styles.phaseTxtWrap, { opacity: txtOp, transform: [{ translateY: txtY }] }]}>
                <Text style={[styles.phaseTxt, { color: phaseColor }]} allowFontScaling={false}>{phaseLabel}</Text>
                <View style={styles.phaseDots}>
                    {PHASES.map((p, i) => {
                        const act = PHASES.findIndex(x => x.key === phase) >= i;
                        const cur = p.key === phase;
                        return <View key={p.key} style={[styles.pd, act && { backgroundColor: phaseColor }, cur && { width: 20 }]} />;
                    })}
                    <View style={[styles.pd, (phase === 'identified' || phase === 'rejected') && { backgroundColor: phaseColor, width: 20 }]} />
                </View>
            </Animated.View>

            {result && (phase === 'identified' || phase === 'rejected') && (
                <Animated.View style={[styles.resCard, {
                    borderColor: phase === 'rejected' ? 'rgba(255,69,58,0.3)' : 'rgba(48,209,88,0.3)',
                    transform: [{ translateY: cardY }], opacity: cardOp,
                }]}>
                    {phase === 'identified' ? (
                        <>
                            <Row label="Category" value={(result.category || 'other').toUpperCase()} />
                            <Row label="Issue" value={result.main_issue || 'Detected'} />
                            <View style={styles.resRow}>
                                <Text style={styles.resL} allowFontScaling={false}>Severity</Text>
                                <View style={[styles.sevBadge, { backgroundColor:
                                    result.ai_severity === 'Critical' ? '#FF003C'
                                    : result.ai_severity === 'High' ? '#FF9500'
                                    : result.ai_severity === 'Medium' ? '#FFD60A' : '#30D158'
                                }]}>
                                    <Text style={styles.sevTxt} allowFontScaling={false}>{result.ai_severity || 'N/A'}</Text>
                                </View>
                            </View>
                            {typeof result.category_confidence === 'number' && (
                                <Row label="Confidence" value={`${(result.category_confidence * 100).toFixed(0)}%`} />
                            )}
                        </>
                    ) : (
                        <Text style={[styles.resV, { color: '#FF453A', textAlign: 'center', padding: 8 }]} allowFontScaling={false}>
                            {result.note || 'Image does not show a valid civic issue.'}
                        </Text>
                    )}
                </Animated.View>
            )}

            <View style={styles.bottomLabel}>
                <View style={styles.aiChip}>
                    <Text style={styles.aiChipTxt} allowFontScaling={false}>UrbanFix AI</Text>
                </View>
                <Text style={styles.bottomTxt} allowFontScaling={false}>Powered by deep learning detection</Text>
            </View>
        </Animated.View>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.resRow}>
            <Text style={styles.resL} allowFontScaling={false}>{label}</Text>
            <Text style={styles.resV} allowFontScaling={false} numberOfLines={1}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,14,0.97)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    grid: { ...StyleSheet.absoluteFillObject, opacity: 0.04 },
    gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#FFF' },
    gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#FFF' },
    multiProg: { position: 'absolute', top: 60, alignItems: 'center' },
    multiText: { fontFamily: fonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
    multiDots: { flexDirection: 'row', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
    dotDone: { backgroundColor: '#30D158' },
    dotActive: { backgroundColor: '#5AC8FA', width: 20, borderRadius: 4 },
    imgWrap: { width: SCREEN_W * 0.78, height: SCREEN_W * 0.78, borderRadius: 20, overflow: 'hidden' },
    glowRing: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 24, borderWidth: 2 },
    img: { width: '100%', height: '100%', borderRadius: 20 },
    scanLine: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#5AC8FA',
        ...Platform.select({ ios: { shadowColor: '#5AC8FA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 12 } }) },
    corner: { position: 'absolute', width: 14, height: 14, borderWidth: 2 },
    cTL: { top: -1, left: -1, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 4 },
    cTR: { top: -1, right: -1, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 4 },
    cBL: { bottom: -1, left: -1, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 4 },
    cBR: { bottom: -1, right: -1, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 4 },
    xhairWrap: { position: 'absolute', top: '50%', left: '50%', marginTop: -30, marginLeft: -30, width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
    xhairLine: { position: 'absolute', backgroundColor: '#FFD60A' },
    xhairDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#FFD60A' },
    burst: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -40, width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
    burstCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center',
        ...Platform.select({ ios: { shadowColor: '#30D158', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 20 }, android: { elevation: 12 } }) },
    phaseTxtWrap: { marginTop: 32, alignItems: 'center' },
    phaseTxt: { fontFamily: fonts.bold, fontSize: 20 },
    phaseDots: { flexDirection: 'row', gap: 6, marginTop: 16 },
    pd: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
    resCard: { marginTop: 24, width: SCREEN_W * 0.78, backgroundColor: 'rgba(28,28,30,0.95)', borderRadius: 16, borderWidth: 1, padding: 16 },
    resRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    resL: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
    resV: { fontFamily: fonts.semibold, fontSize: 14, color: '#FFF' },
    sevBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
    sevTxt: { fontFamily: fonts.bold, fontSize: 11, color: '#FFF' },
    bottomLabel: { position: 'absolute', bottom: 50, alignItems: 'center' },
    aiChip: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(0,122,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,122,255,0.2)', marginBottom: 8 },
    aiChipTxt: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
    bottomTxt: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.3)' },
});

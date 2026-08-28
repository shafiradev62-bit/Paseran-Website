import { useState, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

export type StudentPosition = {
  id: number;
  position: [number, number, number];
  rotation: number;
  gender: "male" | "female";
  seed: number;
};

interface DraggableStudentProps {
  student: StudentPosition;
  onDragEnd: (id: number, newPosition: [number, number, number]) => void;
  onRotate: (id: number, deltaRotation: number) => void;
  isEditMode: boolean;
  children: React.ReactNode;
}

export function DraggableStudent({
  student,
  onDragEnd,
  onRotate,
  isEditMode,
  children,
}: DraggableStudentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersection = useRef(new THREE.Vector3());
  const { camera, raycaster } = useThree();

  useFrame(() => {
    if (!isDragging || !groupRef.current) return;

    raycaster.ray.intersectPlane(plane.current, intersection.current);
    if (intersection.current) {
      groupRef.current.position.x = intersection.current.x;
      groupRef.current.position.z = intersection.current.z;
    }
  });

  const handlePointerDown = (e: { stopPropagation: () => void }) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setIsDragging(true);
  };

  const handlePointerUp = (e: { stopPropagation: () => void }) => {
    if (!isDragging) return;
    e.stopPropagation();
    setIsDragging(false);

    if (groupRef.current) {
      onDragEnd(student.id, [
        groupRef.current.position.x,
        student.position[1],
        groupRef.current.position.z,
      ]);
    }
  };

  const handleRotateLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRotate(student.id, -Math.PI / 8); // Rotate 22.5 degrees left
  };

  const handleRotateRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRotate(student.id, Math.PI / 8); // Rotate 22.5 degrees right
  };

  return (
    <group
      ref={groupRef}
      position={student.position}
      rotation={[0, student.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOver={(e) => {
        if (!isEditMode) return;
        e.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = "move";
      }}
      onPointerOut={() => {
        setIsHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {children}

      {/* Visual indicator when hovering/dragging in edit mode */}
      {isEditMode && (isHovered || isDragging) && (
        <>
          {/* Ground circle indicator */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.6, 32]} />
            <meshBasicMaterial
              color={isDragging ? "#00ff00" : "#ffff00"}
              transparent
              opacity={0.7}
              depthWrite={false}
            />
          </mesh>

          {/* Position label */}
          <Html center position={[0, 2.2, 0]} distanceFactor={10}>
            <div className="student-editor-label">
              <div className="student-info">
                ID: {student.id} | {student.gender === "male" ? "♂" : "♀"}
              </div>
              <div className="student-pos">
                X: {student.position[0].toFixed(1)}, Z: {student.position[2].toFixed(1)}
              </div>
              {isEditMode && (
                <div className="student-controls">
                  <button onClick={handleRotateLeft} className="rotate-btn" title="Rotate Left">
                    ↺
                  </button>
                  <button onClick={handleRotateRight} className="rotate-btn" title="Rotate Right">
                    ↻
                  </button>
                </div>
              )}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

interface EditorPanelProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  students: StudentPosition[];
  onAddStudent: (gender: "male" | "female") => void;
  onRemoveStudent: (id: number) => void;
  onExportPositions: () => void;
  onImportPositions: (positions: StudentPosition[]) => void;
  onResetPositions: () => void;
}

export function EditorPanel({
  isEditMode,
  onToggleEditMode,
  students,
  onAddStudent,
  onRemoveStudent,
  onExportPositions,
  onImportPositions,
  onResetPositions,
}: EditorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        onImportPositions(data);
      } catch (err) {
        alert("Error importing file: Invalid JSON format");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`editor-panel ${isEditMode ? "is-active" : ""}`}>
      <div className="editor-header">
        <h3>Student Position Editor</h3>
        <button
          className={`toggle-edit-btn ${isEditMode ? "active" : ""}`}
          onClick={onToggleEditMode}
        >
          {isEditMode ? "✅ Edit Mode ON" : "⚪ Edit Mode OFF"}
        </button>
      </div>

      {isEditMode && (
        <>
          <div className="editor-section">
            <h4>Add Students</h4>
            <div className="btn-group">
              <button onClick={() => onAddStudent("male")} className="add-btn male">
                + Add Male (♂)
              </button>
              <button onClick={() => onAddStudent("female")} className="add-btn female">
                + Add Female (♀)
              </button>
            </div>
          </div>

          <div className="editor-section">
            <h4>Student List ({students.length})</h4>
            <div className="student-list">
              {students.map((s) => (
                <div key={s.id} className="student-item">
                  <span className="student-icon">{s.gender === "male" ? "♂" : "♀"}</span>
                  <span className="student-id">ID {s.id}</span>
                  <span className="student-position">
                    ({s.position[0].toFixed(1)}, {s.position[2].toFixed(1)})
                  </span>
                  <button
                    onClick={() => onRemoveStudent(s.id)}
                    className="remove-btn"
                    title="Remove student"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="editor-section">
            <h4>Import/Export</h4>
            <div className="btn-group-vertical">
              <button onClick={onExportPositions} className="export-btn">
                📥 Export Positions
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="import-btn">
                📤 Import Positions
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: "none" }}
              />
              <button onClick={onResetPositions} className="reset-btn">
                🔄 Reset to Default
              </button>
            </div>
          </div>

          <div className="editor-instructions">
            <h4>📖 Instructions</h4>
            <ul>
              <li>Click & drag students to move them</li>
              <li>Click ↺/↻ buttons to rotate</li>
              <li>Use Add buttons to create new students</li>
              <li>Click ✕ to remove a student</li>
              <li>Export saves your layout to JSON</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
